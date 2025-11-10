import WebSocket from 'ws'
import { envs } from '../../config/adapters/envs.adapter'
import {WebSocketEvents} from '../../domain/events/events'
import {
  getCurrencyFromAddress,
  loadWalletBalanceLoop,
  printBalance,
  sendSocketMessage,
  setupKeyListener,
} from '../utils/utils'

const ws = new WebSocket(envs.WEBSOCKET_URL)
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
      } else if (data.isRateLimit) {
        process.stdout.write(`   ⚠️  API rate limit reached for BlockCypher.\n`)
        process.stdout.write(`   Please wait a few minutes before trying again.\n`)
        process.stdout.write(`   Or upgrade your BlockCypher token for higher limits.\n`)
        process.stdout.write(`   Get your token at: https://accounts.blockcypher.com/tokens\n`)
      }
      process.stdout.write('\n')
      break
    }
  }
})

ws.on('close', () => shutdown())

