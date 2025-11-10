export enum KafkaTopics {
  CurrencyPrice = 'currency-price',
  WalletBalance = 'wallet-balance',
  TaskToReadBalance = 'task-to-read-balance'
}

export enum WebSocketEvents {
  SetupWallet = 'setup-wallet',
  ReadBalance = 'read-balance',
  PriceUpdated = 'price-updated',
  BalanceUpdated = 'balance-updated'
}
