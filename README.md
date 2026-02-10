payload para teste de concorrência:
```
POST /reservations
{
  "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sessionId": "session-1",
  "seatIds": ["seat-1", "seat-2"]
}
```

payload para confirmação de pagamento de reserva:
```
POST /payments/confirm
{
  "reservationId": ""
}
```