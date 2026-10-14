import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClone, faFolder, faFolderOpen, faFolderPlus, faImage, faPenToSquare, faSkull, faTrash, faUser, faUserGear, faUserPlus,
} from '@fortawesome/free-solid-svg-icons'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { itensDeImagem, useMostrarImagem } from './mostrarImagem'
import { imagemDoToken, type Ator } from './atores'
import { montarArvore, type NoPasta, type Pasta } from './cenas'
import type { CriaturaResumo, FichaResumo } from './useAtores'

export const TIPO_ARRASTO_ATOR = 'application/x-arkanis-ator'

type Acoes = {
  onAbrir: (a: Ator) => void
  onPropriedade: (a: Ator) => void
  onToken: (a: Ator) => void
  onExcluir: (a: Ator) => void
  onDuplicar: (a: Ator) => void
  onCriar: (pasta: string | null) => void
  onCriarPasta: (pai: string | null) => void
  onEditarPasta: (p: Pasta) => void
  onExcluirPasta: (p: Pasta) => void
}

// Aba Personagens (12.7), no visual do print do Foundry ("Atores" vira "Personagens"):
// Criar Personagem / Criar Pasta e a lista com a miniatura do token e o nome.
export default function PainelPersonagens({ souMestre, userId, atores, pastas, fichas, criaturas, acoes }: {
  souMestre: boolean
  userId: string
  atores: Ator[]
  pastas: Pasta[]
  fichas: Record<string, FichaResumo>
  criaturas: Record<string, CriaturaResumo>
  acoes: Acoes
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const imagem = useMostrarImagem()
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())
  const arvore = montarArvore<Ator>(pastas, atores)

  // Dono: quem criou a ficha, ou quem o mestre marcou como Dono em Configurar Propriedade.
  const ehDono = (a: Ator) =>
    souMestre || (a.character_id !== null && fichas[a.character_id]?.user_id === userId) || a.acesso_jogadores?.[userId] === 'dono'
  const miniatura = (a: Ator) =>
    imagemDoToken(a, (a.character_id && fichas[a.character_id]?.avatar_url) || (a.creature_id && criaturas[a.creature_id]?.image_url) || null)

  function menuDoAtor(e: React.MouseEvent, a: Ator) {
    e.preventDefault()
    if (!ehDono(a)) return
    const itens: ItemMenu[] = [
      { rotulo: 'Editar', icone: faPenToSquare, onClick: () => acoes.onAbrir(a) },
      ...(souMestre && a.tipo !== 'jogador' ? [{ rotulo: 'Configurar Propriedade', icone: faUserGear, onClick: () => acoes.onPropriedade(a) } as ItemMenu] : []),
      { rotulo: 'Configurar Token', icone: faImage, onClick: () => acoes.onToken(a) },
      // A foto da ficha (a redonda) ou, sem ela, o token.
      ...itensDeImagem(imagem, (a.character_id && fichas[a.character_id]?.avatar_url) || (a.creature_id && criaturas[a.creature_id]?.image_url) || miniatura(a), a.name),
      ...(souMestre && a.tipo !== 'jogador'
        ? [
            { tipo: 'linha' } as ItemMenu,
            { rotulo: 'Duplicar', icone: faClone, onClick: () => acoes.onDuplicar(a) } as ItemMenu,
            { rotulo: 'Excluir', icone: faTrash, perigo: true, onClick: () => acoes.onExcluir(a) } as ItemMenu,
          ]
        : []),
    ]
    setMenu({ x: e.clientX, y: e.clientY, itens })
  }

  function menuDaPasta(e: React.MouseEvent, p: Pasta) {
    e.preventDefault()
    if (!souMestre) return
    setMenu({
      x: e.clientX,
      y: e.clientY,
      itens: [
        { rotulo: 'Editar Pasta', icone: faPenToSquare, onClick: () => acoes.onEditarPasta(p) },
        { rotulo: 'Remover Pasta', icone: faTrash, perigo: true, onClick: () => acoes.onExcluirPasta(p) },
      ],
    })
  }

  const linha = (a: Ator) => {
    const img = miniatura(a)
    const arrastavel = ehDono(a)
    return (
      <li key={a.id}>
        <button
          type="button"
          className="ator-linha"
          draggable={arrastavel}
          onDragStart={(e) => {
            // Arrastar o personagem pro mapa coloca o token principal dele (12.8).
            e.dataTransfer.setData(TIPO_ARRASTO_ATOR, a.id)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => acoes.onAbrir(a)}
          onContextMenu={(e) => menuDoAtor(e, a)}
          title={arrastavel ? 'Arraste pro mapa pra colocar o token' : undefined}
        >
          <span className="ator-token">{img ? <img src={img} alt="" draggable={false} /> : <FontAwesomeIcon icon={a.tipo === 'ameaca' ? faSkull : faUser} />}</span>
          <span className="ator-nome">{a.name}</span>
        </button>
      </li>
    )
  }

  const pasta = (n: NoPasta<Ator>) => {
    const aberta = !fechadas.has(n.pasta.id)
    return (
      <li key={n.pasta.id} className="cena-pasta">
        <div className="cena-pasta-topo" style={n.pasta.color ? { background: n.pasta.color } : undefined} onContextMenu={(e) => menuDaPasta(e, n.pasta)}>
          <button
            type="button"
            className="cena-pasta-nome"
            aria-expanded={aberta}
            onClick={() => setFechadas((s) => { const x = new Set(s); if (x.has(n.pasta.id)) x.delete(n.pasta.id); else x.add(n.pasta.id); return x })}
          >
            <FontAwesomeIcon icon={aberta ? faFolderOpen : faFolder} /> {n.pasta.name}
          </button>
          {souMestre && (
            <>
              <button type="button" className="cena-pasta-acao" aria-label="Criar outra pasta" title="Criar Pasta" onClick={() => acoes.onCriarPasta(n.pasta.id)}>
                <FontAwesomeIcon icon={faFolderPlus} />
              </button>
              <button type="button" className="cena-pasta-acao" aria-label="Criar personagem nesta pasta" title="Criar Personagem" onClick={() => acoes.onCriar(n.pasta.id)}>
                <FontAwesomeIcon icon={faUserPlus} />
              </button>
            </>
          )}
        </div>
        {aberta && (
          <ul className="cena-lista">
            {n.pastas.map(pasta)}
            {n.cenas.map(linha)}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="cenas-painel">
      {souMestre && (
        <div className="cenas-botoes">
          <button type="button" className="mesa-botao" onClick={() => acoes.onCriar(null)}>
            <FontAwesomeIcon icon={faUser} /> Criar Personagem
          </button>
          <button type="button" className="mesa-botao" onClick={() => acoes.onCriarPasta(null)}>
            <FontAwesomeIcon icon={faFolder} /> Criar Pasta
          </button>
        </div>
      )}

      {!atores.length && <p className="mesa-painel-vazio">Nenhum personagem ainda. Quem entrar pelo convite aparece aqui.</p>}

      <ul className="cena-lista cena-raiz">
        {arvore.pastas.map(pasta)}
        {arvore.cenas.map(linha)}
      </ul>

      {menu && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <MenuContexto x={menu.x} y={menu.y} itens={menu.itens} onFechar={() => setMenu(null)} />
        </div>
      )}
    </div>
  )
}
