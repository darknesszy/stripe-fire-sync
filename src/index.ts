import 'reflect-metadata'
import FirebaseAdmin from 'firebase-admin'
import dotenv from 'dotenv'
import { Container } from 'inversify'
import { PaymentSyncer } from './payment'

// Setup environment variables
const result = dotenv.config()
if (!result.error) console.log('Environment Variables from .env is used')

const serviceProvider = new Container()
serviceProvider.bind<PaymentSyncer>(PaymentSyncer).toSelf().inTransientScope()

console.log('# Running Stripe Fire Sync...')

const paymentSyncer = serviceProvider.resolve(PaymentSyncer)
paymentSyncer.syncToStripe()