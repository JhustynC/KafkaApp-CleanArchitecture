import WebSocket from 'ws'
import {WebSocketEvents} from '../../domain/events/events'
import {
  getCurrencyFromAddress,
  loadWalletBalanceLoop,
  printBalance,
  sendSocketMessage,
  setupKeyListener,
} from '../utils/utils'

const ws = new WebSocket('ws://localhost:3000')
const address = process.argv[2]
const currency = getCurrencyFromAddress(address)
let balance: number | undefined
let price: number | undefined

async function shutdown() {
  Array.apply(null, Array(4)).forEach(() => process.stdout.write('\n'))
  await ws.close()
  process.exit(0)
}

ws.on('open', () => {
  sendSocketMessage(ws, WebSocketEvents.SetupWallet, address)

  setupKeyListener({
    onEnter: () => sendSocketMessage(ws, WebSocketEvents.ReadBalance),
    onClose: () => shutdown(),
  })

  loadWalletBalanceLoop(ws, 60)
})

ws.on('message', (json: string) => {
  const {data, type} = JSON.parse(json)

  switch (type) {
    case WebSocketEvents.BalanceUpdated: {
      balance = data.balance
      printBalance(currency, price, balance)
      break
    }

    case WebSocketEvents.PriceUpdated: {
      price = data.price
      printBalance(currency, price, balance)
      break
    }

    case WebSocketEvents.Error: {
      process.stdout.write('\n')
      process.stdout.write(`❌ Error: ${data.error}\n`)
      if (data.isNotFound) {
        process.stdout.write(`   The wallet address "${data.address}" was not found.\n`)
        process.stdout.write(`   Please verify the address and try again.\n`)
      }
      process.stdout.write('\n')
      break
    }
  }
})

ws.on('close', () => shutdown())

