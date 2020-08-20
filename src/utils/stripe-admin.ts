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

    }
}