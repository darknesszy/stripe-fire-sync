import FirebaseAdmin from 'firebase-admin'
import dotenv from 'dotenv'
import * as StripeAdmin from './utils/stripe-admin'
import * as products from './sync-to-stripe/products'

// Setup environment variables
const result = dotenv.config()
if (!result.error) console.log('Environment Variables from .env is used')

// Setup Firebase admin tool.
FirebaseAdmin.initializeApp({
    credential: FirebaseAdmin.credential.cert(require(process.env['FIREBASE_PRIVATE_KEY']!)),
    databaseURL: process.env['FIREBASE_URL']
})

// Setup Stripe admin tool.
StripeAdmin.initialiseClient({ apiVersion: '2020-03-02', typescript: true })

console.log('# Running Stripe Fire Sync...')

products.sync()