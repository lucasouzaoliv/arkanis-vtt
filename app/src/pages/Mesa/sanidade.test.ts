import { expect, it } from 'vitest'
import { ferimentoDaVida, loucuraDaSanidade, SEM_FERIMENTO, SEM_LOUCURA } from './sanidade'

it('a loucura começa no 7 de SAN e só ondula do 3 pra baixo (KAN-116, ajuste 28/10)', () => {
  expect(loucuraDaSanidade(20, 40)).toEqual(SEM_LOUCURA)
  expect(loucuraDaSanidade(8, 40)).toEqual(SEM_LOUCURA)
  const sete = loucuraDaSanidade(7, 40)
  expect(sete.intensidade).toBe(0.15)
  expect(sete.ondulacao).toBe(0)
  expect(sete.olhos).toBe(0)
  expect(loucuraDaSanidade(4, 40)).toMatchObject({ ondulacao: 0, olhos: 1, sangue: true, garras: false })
  expect(loucuraDaSanidade(3, 40)).toMatchObject({ ondulacao: 0.3, garras: true })
  expect(loucuraDaSanidade(0, 40)).toMatchObject({ intensidade: 1, ondulacao: 1, olhos: 3, coracao: true })
  expect(loucuraDaSanidade(-2, 40).intensidade).toBe(1)
  // Sem SAN máxima (ficha sem classe): nada.
  expect(loucuraDaSanidade(2, null)).toEqual(SEM_LOUCURA)
})

it('a vida baixa sangra da metade pra baixo, borra no último quarto e desmaia no zero', () => {
  expect(ferimentoDaVida(20, 20)).toEqual(SEM_FERIMENTO)
  expect(ferimentoDaVida(11, 20)).toEqual(SEM_FERIMENTO)
  expect(ferimentoDaVida(10, 20)).toEqual({ intensidade: 0.2, borrao: 0, pingos: 2, desmaiado: false })
  expect(ferimentoDaVida(5, 20).borrao).toBe(0.6)
  expect(ferimentoDaVida(1, 20).borrao).toBeGreaterThan(2)
  expect(ferimentoDaVida(0, 20).desmaiado).toBe(true)
  expect(ferimentoDaVida(0, null)).toEqual(SEM_FERIMENTO)
})
