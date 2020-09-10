import 'reflect-metadata'
import dotenv from 'dotenv'
import { Container } from 'inversify'
import { clearStripeIds } from './utils/purger'
import { PaymentSyncer } from './payment'
import { FirestoreClient, StripeClient } from './clients'

// Setup environment variables
const result = dotenv.config()
if (!result.error) console.log('Environment Variables from .env is used')

const serviceProvider = new Container()
serviceProvider.bind<FirestoreClient>(FirestoreClient).toSelf().inSingletonScope()
serviceProvider.bind<StripeClient>(StripeClient).toSelf().inSingletonScope()
serviceProvider.bind<PaymentSyncer>(PaymentSyncer).toSelf().inTransientScope()

console.log('# Running Stripe FireSync...')

const paymentSyncer = serviceProvider.resolve(PaymentSyncer)
paymentSyncer.syncToStripe()
// clearStripeIds('product')