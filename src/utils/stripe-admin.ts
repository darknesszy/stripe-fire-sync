import Stripe from 'stripe'

let config: Stripe.StripeConfig
let client: Stripe

export const initialiseClient = (conf: Stripe.StripeConfig) => {
    config = conf
}

export const getClient = () => {
    if (!client) {
        client = new Stripe(process.env['STRIPE_PUBLIC_KEY']!, config)
    }
    return client
}

export const connect = () => {
    const stripeClient = getClient()

    return {
        list: async () => {
            const products = (await stripeClient.products.list()).data
            const prices = (await stripeClient.prices.list()).data.filter(el => el.active)
            return products.map(product => {
                const price = prices.find(el => el.product == product.id && el.active)
                if(price == undefined) throw Error(`Dangling Product detected: ${product.name} - ${product.id}`)
                return { ...product, price }
            })
        },
        // deleteAll: async () => {
        //     const products = (await stripeClient.products.list()).data
        //     const prices = (await stripeClient.prices.list()).data.filter(el => el.active)

        //     prices.forEach(async el => {
        //         stripeClient.products.del()
        //     })
        //     stripeClient.products.del()
        // }
    }
}