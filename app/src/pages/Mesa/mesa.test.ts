import { describe, expect, it } from 'vitest'
import { ABAS_DIREITA, calcularFps, comFichasDadas, conectados, corDaPessoa, linkDeConvite, primeiroNome, rotuloJogador, type Membro } from './mesa'

const membros: Membro[] = [
  { userId: 'j2', papel: 'jogador', nomeConta: 'Pedro Alves', personagem: 'Zeca' },
  { userId: 'm', papel: 'mestre', nomeConta: 'Millie', personagem: null },
  { userId: 'j1', papel: 'jogador', nomeConta: 'Maria Souza', personagem: 'Arthur' },
  { userId: 'j3', papel: 'jogador', nomeConta: 'Ana', personagem: null },
]

describe('rótulos do painel de sessão', () => {
  it('reduz a conta ao primeiro nome', () => {
    expect(primeiroNome('  Maria   Souza ')).toBe('Maria')
    expect(primeiroNome('')).toBe('Sem nome')
  })

  it('mostra "Personagem (PrimeiroNome)"', () => {
    expect(rotuloJogador({ nomeConta: 'Millie Lucas', personagem: 'Novo Agente' })).toBe('Novo Agente (Millie)')
  })

  it('sem personagem mostra só a conta', () => {
    expect(rotuloJogador({ nomeConta: 'Ana Lima', personagem: null })).toBe('Ana')
    expect(rotuloJogador({ nomeConta: 'Ana Lima', personagem: '  ' })).toBe('Ana')
  })
})

describe('conectados', () => {
  it('lista só quem está com a mesa aberta, mestre primeiro', () => {
    const lista = conectados(membros, [{ userId: 'j2' }, { userId: 'j1' }, { userId: 'm' }])
    expect(lista.map((m) => m.userId)).toEqual(['m', 'j1', 'j2'])
  })

  it('conta uma vez quem abriu em várias abas', () => {
    expect(conectados(membros, [{ userId: 'j1' }, { userId: 'j1' }])).toHaveLength(1)
  })

  it('ignora presença de quem não é membro', () => {
    expect(conectados(membros, [{ userId: 'intruso' }])).toEqual([])
  })
})

describe('calcularFps', () => {
  it('conta quadros por segundo', () => {
    const instantes = Array.from({ length: 61 }, (_, i) => i * (1000 / 60))
    expect(calcularFps(instantes)).toBe(60)
  })

  it('sem quadros suficientes dá zero', () => {
    expect(calcularFps([])).toBe(0)
    expect(calcularFps([5, 5])).toBe(0)
  })
})

describe('barra direita', () => {
  it('segue a ordem da spec, começando pelo chat', () => {
    expect(ABAS_DIREITA.map((a) => a.id)).toEqual(['chat', 'combate', 'cenas', 'posicionaveis', 'personagens', 'itens', 'diario', 'playlist', 'config'])
  })
})

it('monta o link de convite', () => {
  expect(linkDeConvite('https://arkanis.app', 'abc123')).toBe('https://arkanis.app/campanha/entrar/abc123')
})

it('convite copiado no localhost sai com o endereço público', () => {
  expect(linkDeConvite('http://localhost:5173', '07ebdc4eac')).toBe('https://arkanis-vtt.vercel.app/campanha/entrar/07ebdc4eac')
  expect(linkDeConvite('http://127.0.0.1:5173', 'x')).toBe('https://arkanis-vtt.vercel.app/campanha/entrar/x')
})

describe('comFichasDadas', () => {
  const jogador = { userId: 'j1', papel: 'jogador' as const, nomeConta: 'Ana', personagem: null, personagemId: null }
  const ator = (acesso: Record<string, string>, extra: object = {}) => ({ tipo: 'npc', character_id: 'f1', name: 'Sam Ávila', token_url: '/sam.webp', acesso_jogadores: acesso, ...extra })

  it('ficha do mestre com Dono pro jogador vira o personagem dele', () => {
    const [m] = comFichasDadas([jogador], [ator({ j1: 'dono' })])
    expect(m).toMatchObject({ personagem: 'Sam Ávila', personagemId: 'f1', fotoPersonagem: '/sam.webp' })
  })

  it('observador não basta, e personagem próprio vem primeiro', () => {
    expect(comFichasDadas([jogador], [ator({ j1: 'observador' })])[0].personagemId).toBeNull()
    const proprio = { ...jogador, personagem: 'Meu', personagemId: 'meu' }
    expect(comFichasDadas([proprio], [ator({ j1: 'dono' })])[0].personagemId).toBe('meu')
  })

  it('ameaça não vira personagem, e o mestre fica como está', () => {
    expect(comFichasDadas([jogador], [ator({ j1: 'dono' }, { tipo: 'ameaca' })])[0].personagemId).toBeNull()
    const mestre = { ...jogador, papel: 'mestre' as const }
    expect(comFichasDadas([mestre], [ator({ j1: 'dono' })])[0].personagemId).toBeNull()
  })

  it('usa a foto da ficha quando tem', () => {
    expect(comFichasDadas([jogador], [ator({ j1: 'dono' })], () => '/foto.webp')[0].fotoPersonagem).toBe('/foto.webp')
  })
})

it('a cor da pessoa é a que ela escolheu; sem escolher, uma fixa', () => {
  expect(corDaPessoa('u1', '#072da2')).toBe('#072da2')
  expect(corDaPessoa('u1', null)).toBe(corDaPessoa('u1'))
  expect(corDaPessoa('u1', 'vermelho')).toBe(corDaPessoa('u1'))
  expect(corDaPessoa('u1')).toMatch(/^#[0-9a-f]{6}$/)
})
