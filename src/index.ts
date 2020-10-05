import 'reflect-metadata'
import dotenv from 'dotenv'
import minimist from 'minimist'
import { Container } from 'inversify'
import { clearStripeIds } from './utils/purger'
import { ProductETL } from './product'
import { FirestoreClient, StripeClient } from './clients'
import { CategoricProductETL } from './product/categoric-product-etl'
import { ShopifyProductETL } from './product/shopify-product-etl'

// Setup environment variables
const result = dotenv.config()
if (!result.error) console.log('Environment Variables from .env is used')

const serviceProvider = new Container()
serviceProvider.bind<FirestoreClient>(FirestoreClient).toSelf().inSingletonScope()
serviceProvider.bind<StripeClient>(StripeClient).toSelf().inSingletonScope()
serviceProvider.bind<ProductETL>(ProductETL).toSelf().inTransientScope()
serviceProvider.bind<CategoricProductETL>(CategoricProductETL).toSelf().inTransientScope()
serviceProvider.bind<ShopifyProductETL>(ShopifyProductETL).toSelf().inTransientScope()

console.log('# Running Stripe FireSync...')

var args = minimist(process.argv.slice(2))
if(args['product']) {
    const collectionName = args['s'] || args['sync']
    const priceKey = args['p'] || args['price']
    const nameKey = args['n'] || args['name']

    switch(args['product']) {
        case true:
            const etl = serviceProvider.resolve(ProductETL)
            etl.syncToStripe(collectionName, { nameKey, priceKey })
            break
        case 'shopify':
            const shopify = serviceProvider.resolve(ShopifyProductETL)
            shopify.syncToStripe(collectionName)
            break
        default:
            const category = serviceProvider.resolve(CategoricProductETL)
            category.syncToStripe(collectionName, { categoryKey: args['product'], nameKey, priceKey })
            break
    }

} else if(args['clear']) {
    const collectionName = args['s'] || args['sync']
    clearStripeIds(collectionName)
} else {
    throw Error('Not a valid command');
}