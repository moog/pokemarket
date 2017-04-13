'use strict'

const Promise = require('bluebird');
const Pokemon = require('../models/pokemon');
const Pagarme = require('../services/pagarme');
const sequelize = require('../config/db.js');
const errors = require('../utils/errors.js')

async function getPokemons (req, res) {

    try {
        const pokemons = await Pokemon.findAll();

        return res.json({ error: errors.NO_ERROR, pokemons });
    } catch (err) {
        return res.status(400).json({ error: errors.TRY_AGAIN, message: 'Oops, try again later!' });
    }   

};

async function createPokemon (req, res) {

    try {
        const pokemon = await Pokemon.create(req.body);

        return res.json({ error: errors.NO_ERROR, pokemon });
    } catch (err) {
        return res.status(400).json({ error: errors.TRY_AGAIN, message: 'Oops, try again later!' });
    }     

};

async function buyPokemon (req, res) {  

    const pagarme = new Pagarme();

    let transaction = null;
    let pokemon = null;

    // Init transaction and get the selected pokemon by UUID
    try {
        let pokemonTransaction = await Promise.props({
            transaction: sequelize.transaction(),
            pokemon: Pokemon.findOne({ where: { uuid: req.body.uuid } })
        });

        transaction = pokemonTransaction.transaction;
        pokemon = pokemonTransaction.pokemon;

        if (!pokemon) {
            return res.status(404).json({ 
                error: errors.POKEMON_NONEXISTENT,
                message: 'This Pokemon not exist.'
            });            
        }
    } catch (err) {
        return res.status(500).json({ 
            error: errors.INTERNAL, 
            message: 'Internal server error.' 
        });
    }

    // Calcuate and validate amount 
    const totalAmount = req.body.quantity * pokemon.price;    
    if(!pagarme.isValidAmount(totalAmount)) {        
        return res.status(400).json({ 
            error: errors.EXPENSIVE, 
            message: 'The total amount of this purchase is too much high. Please, be most humble. :p' 
        });
    }

    // Verify if the quantity is on stock
    if (pokemon.stock < req.body.quantity) {
        return res.status(400).json({ 
            error: errors.OUT_STOCK, 
            message: `We only have ${pokemon.stock} ${pokemon.name} in stock.` 
        });
    }
    
    // Try decrement the quantity on stock
    try {
        await pokemon.decrement('stock', { by: req.body.quantity, transaction });
    } catch (err) {
        return res.status(400).json({ 
            error: errors.DB_STOCK, 
            message: 'Error while get the pokemon quantity on stock. Try again latter.' 
        });
    }

    // Update the model
    await pokemon.reload();    
    
    const transactionInfo = {
        amount: totalAmount,
        paymentMethod: pagarme.paymentMethods.CREDIT_CARD,
        card: {
            number: '4024007138010896',
            expirationDate: '1050',
            holderName: 'Ash Ketchum',
            cvv: '123'
        },
        metadata: {
            product: 'pokemon',
            name: pokemon.name,
            quantity: req.body.quantity
        }
    }

    // Try the payment on Pagar.me
    try {
        const pagarmeTransaction = await pagarme.transaction(transactionInfo);
        
        if (pagarmeTransaction.status == pagarme.transactionStatus.PAID) {
            await transaction.commit();
        } else {
            throw new Error(pagarmeTransaction);
        }

        return res.json({ 
            error: errors.NO_ERROR,
            transactionStatus: pagarmeTransaction.status
        });
    } catch (err) { 
        console.log(err)
        await transaction.rollback();
        return res.status(400).json({
            error: errors.PURCHASE_FAILED,
            message: 'The purchase failed, try again latter.'
        });
    }

};

module.exports = { 
    getPokemons, 
    createPokemon, 
    buyPokemon
};