export interface ProductOptions {
    priceKey?: string
    nameKey?: string
}

export interface CategoricProductOptions extends ProductOptions {
    categoryKey: string
}