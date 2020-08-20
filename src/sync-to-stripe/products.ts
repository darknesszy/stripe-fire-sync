import { firestore } from 'firebase-admin'

export const sync = async () => {
    await fetchData()
}

export const fetchData = async () => {
    const client = firestore()
    const products = await client.collection('products').get()
    products.forEach(doc => {
        doc.data()
        console.log('tester', doc.data())
    })
}