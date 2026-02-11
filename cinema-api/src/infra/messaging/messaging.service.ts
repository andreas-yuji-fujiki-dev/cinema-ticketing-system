import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import * as amqplib from 'amqplib'

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name)
  private connection: amqplib.Connection | null = null
  private channel: amqplib.Channel | null = null
  private ready: Promise<void>
  private readyResolve!: () => void

  constructor() {
    this.ready = new Promise((res) => (this.readyResolve = res))
  }

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASSWORD || 'guest'}@${process.env.RABBITMQ_HOST || 'rabbitmq'}:${process.env.RABBITMQ_PORT || 5672}`

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

    let attempt = 0
    while (true) {
      attempt++
      try {
        this.connection = await amqplib.connect(url)
        this.channel = await this.connection.createChannel()
        await this.channel.assertExchange('events', 'topic', { durable: true })

        this.logger.log('Connected to RabbitMQ')

        // resolve ready so consumers can register
        this.readyResolve()

        // attach basic error/close logging
        this.connection.on('error', (err) => this.logger.error(`RabbitMQ connection error: ${err}`))
        
        this.connection.on('close', async () => {

          this.logger.warn('RabbitMQ connection closed')
          
          // try to reconnect in background
          attempt = 0
          
          // create a new ready promise so registerConsumer waits if reconnect happens before app restarts
          this.ready = new Promise((res) => (this.readyResolve = res))
          
          // start reconnect loop
          ;(async () => {
            while (true) {
              try {
                this.connection = await amqplib.connect(url)
                this.channel = await this.connection.createChannel()
                await this.channel.assertExchange('events', 'topic', { durable: true })
                this.logger.log('Reconnected to RabbitMQ')
                this.readyResolve()
                break
              } catch (e) {
                this.logger.warn(`Reconnect attempt failed: ${e}`)
                await delay(2000)
              }
            }
          })()
        })

        break
      } catch (err) {
        const wait = Math.min(5000, 500 * attempt)
        this.logger.warn(`Failed to connect to RabbitMQ (attempt ${attempt}), retrying in ${wait}ms: ${err}`)
        await delay(wait)
      }
    }
  }

  async publish(event: string, payload: any) {
    await this.ready
    if (!this.channel) {
      this.logger.warn('No channel available to publish event')
      return
    }

    try {
      const content = Buffer.from(JSON.stringify(payload || {}))
      // ensure exchange exists and is durable
      await this.channel.assertExchange('events', 'topic', { durable: true })
      this.channel.publish('events', event, content)
      this.logger.log(`Published event ${event}`)
    } catch (err) {
      this.logger.error(`Publish failed for ${event}: ${err}`)
    }
  }

   /**
   * Register a named, durable queue and bind it to the list of routing keys (events).
   * Each consumer should call this in their onModuleInit.
   */
  async registerConsumer(
    queueName: string,
    events: string[],
    handler: (payload: any) => Promise<void> | void,
  ) {
    await this.ready
    if (!this.channel) {
      this.logger.warn('No channel available to register consumer')
      return
    }

    // ensure exchange exists and is durable
    await this.channel.assertExchange('events', 'topic', { durable: true })

    // create a durable, named queue that survives restarts
    await this.channel.assertQueue(queueName, { durable: true })

    for (const event of events) {
      await this.channel.bindQueue(queueName, 'events', event)
    }

    await this.channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return

        try {
          const payload = JSON.parse(msg.content.toString())
          await Promise.resolve(handler(payload))
        } catch (err) {
          this.logger.error(`Failed handling message on ${queueName}: ${err}`)
        } finally {
          try {
            this.channel?.ack(msg)
          } catch (ackErr) {
            this.logger.error(`Failed ack message on ${queueName}: ${ackErr}`)
          }
        }
      },
      { noAck: false },
    )

    this.logger.log(`Registered consumer queue ${queueName} for events: ${events.join(',')}`)
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close()
      await this.connection?.close()
    } catch (err) {
      // ignore
    }
  }
}
