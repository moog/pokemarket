const app = require('../src/index.js')
const request = require('supertest')(app)
const Pagarme = require('../src/services/pagarme.js')
const errors = require('../src/utils/errors.js')

const pagarme = new Pagarme()

const model = { name: 'Charizard', price: 214792, stock: 9999 }
const buyModel = { quantity: 5 }
const buyExpensiveModel = { quantity: 9999 }
const buyOutStockModel = { quantity: 9996 }
const buyNonexistentModel = { uuid: '9afc8409-2890-4e3f-b365-deaaf2b28e01', quantity: 1 }

describe('PokeMarket', () => {
  it('should create a pokemon', async () => {
    const { body } = await request.put('/pokemons').send(model).expect(200)

    expect(body.error).toBe(errors.NO_ERROR)
    expect(body.pokemon).toBeDefined()
    expect(body.pokemon.uuid).toBeDefined()

    buyModel.uuid = body.pokemon.uuid
    buyExpensiveModel.uuid = body.pokemon.uuid
    buyOutStockModel.uuid = body.pokemon.uuid
  })

  it('should get all pokemons', async () => {
    const { body } = await request.get('/pokemons').expect(200)

    expect(body.error).toBe(errors.NO_ERROR)
    expect(body.pokemons).toBeDefined()
    expect(Array.isArray(body.pokemons)).toBeTruthy()
    expect(body.pokemons.length).toBeGreaterThan(0)
  })

  it(`should not be able to make a purchase priced above ${pagarme.maxAmount}`, async () => {
    const { body } = await request.post('/pokemons/buy').send(buyExpensiveModel).expect(400)

    expect(body.error).toBe(errors.EXPENSIVE)
  })

  it('should buy a pokemon', async () => {
    const { body } = await request.post('/pokemons/buy').send(buyModel).expect(200)

    expect(body.error).toBe(errors.NO_ERROR)
    expect(body.transactionStatus).toBe('paid')
  })

  it('should not buy a pokemon out stock', async () => {
    const { body } = await request.post('/pokemons/buy').send(buyOutStockModel).expect(400)

    expect(body.error).toBe(errors.OUT_STOCK)
  })

  it('should not buy a nonexistent pokemon', async () => {
    const { body } = await request.post('/pokemons/buy').send(buyNonexistentModel).expect(404)

    expect(body.error).toBe(errors.POKEMON_NONEXISTENT)
  })
})
