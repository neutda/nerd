import { startCollabServer } from './server'

const PORT = Number(process.env.PORT || 4780)
const HOST = process.env.HOST || '0.0.0.0'

startCollabServer({ host: HOST, port: PORT })
  .then(() => {
    console.log(`[nerd-collab] listening on http://${HOST}:${PORT}`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
