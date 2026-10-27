import { useState } from 'react'
import { faUserSecret } from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import { gerarNpc, textoDoNpc, type Npc } from './geradorNpc'

// Gerador de NPC rápido (KAN-122): sorteia, copia ou já cria o NPC na aba Personagens.
export default function GeradorDeNpc({ onCriar, onFechar }: { onCriar: (npc: Npc) => void; onFechar: () => void }) {
  const [npc, setNpc] = useState<Npc>(() => gerarNpc())
  const [copiado, setCopiado] = useState(false)
  const linhas: [string, string][] = [
    ['Idade', `${npc.idade} anos`],
    ['Profissão', npc.profissao],
    ['Aparência', npc.aparencia],
    ['Jeito', npc.jeito],
    ['Algo estranho', npc.estranho],
  ]
  return (
    <Janela titulo="Gerador de NPC" icone={faUserSecret} largura={380} onFechar={onFechar}>
      <div className="janela-form gerador-npc">
        <h3 className="gerador-npc-nome">{npc.nome}</h3>
        <dl className="gerador-npc-lista">
          {linhas.map(([r, v]) => (
            <div key={r}><dt>{r}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className="gerador-npc-botoes">
          <button type="button" className="janela-botao janela-botao-destaque" onClick={() => { setNpc(gerarNpc()); setCopiado(false) }}>Gerar outro</button>
          <button type="button" className="janela-botao" onClick={() => { void navigator.clipboard?.writeText(textoDoNpc(npc)); setCopiado(true) }}>{copiado ? 'Copiado!' : 'Copiar'}</button>
          <button type="button" className="janela-botao" onClick={() => onCriar(npc)}>Criar NPC</button>
        </div>
      </div>
    </Janela>
  )
}
