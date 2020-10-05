import { injectable } from "inversify"
import Stripe from 'stripe'

@injectable()
export class StripeClient {
    private client: Stripe

    constructor() {
        this.client = new Stripe(
            process.env['STRIPE_SECRET_KEY']!,
            {
                apiVersion: '2020-08-27',
                typescript: true
            }
        )
    }

    connect() {
        return this.client
    }

    dispose() {
        // this.client.
    }
}