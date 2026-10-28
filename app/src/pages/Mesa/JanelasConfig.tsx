import { useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClock, faComment, faDice, faFloppyDisk, faFont, faGamepad, faGears, faGlobe, faMagnifyingGlass, faPlus, faRotateLeft, faShieldHalved, faSwatchbook,
  faTrash, faUpload, faUserMinus, faUsers, faVolumeHigh, faXmarksLines, type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import Janela, { Campo, CampoCor, Deslizante } from './Janela'
import { EVENTO_TESTAR_DADOS } from './DadosNaTela'
import { ELEMENTOS, type Elemento } from './elementosDosDados'
import {
  ESTILO_PADRAO, estiloCompleto, lerPreferenciasDados, MATERIAIS_DADO, PREFERENCIAS_PADRAO, salvarPreferenciasDados, TEXTURAS_DADO,
  type EstiloDados, type MaterialDado, type PreferenciasDados,
} from './estiloDados'
import {
  ATALHOS, combateDa, INTERFACE_PADRAO, lerInterface, PERMISSOES, PESOS_FONTE, salvarInterface,
  type ConfigCampanha, type FonteAdicional, type PermissoesCampanha,
} from './configuracoes'
import { salvarVolume, useVolumesDoUsuario, VOLUMES_PADRAO } from './volumesDoUsuario'
import type { Canal } from './playlists'

export type SecaoConfig = 'interface' | 'som' | 'dados' | 'chat' | 'permissoes' | 'fontes' | 'combate' | 'tempo'

const SECOES: { id: SecaoConfig; rotulo: string; icone: IconDefinition; descricao: string; mestre?: boolean }[] = [
  { id: 'interface', rotulo: 'Interface de Usuário', icone: faSwatchbook, descricao: 'Tamanho da interface (painéis, janelas e textos) na sua tela.' },
  { id: 'som', rotulo: 'Som', icone: faVolumeHigh, descricao: 'Volume da música, do ambiente e dos efeitos sonoros (só pra você).' },
  { id: 'dados', rotulo: 'Dados', icone: faDice, descricao: 'Mostrar os dados 3D e a aparência dos seus dados (todo mundo vê os seus assim).' },
  { id: 'chat', rotulo: 'Chat', icone: faComment, descricao: 'O nome que aparece nas suas mensagens.' },
  { id: 'permissoes', rotulo: 'Permissões de Usuários', icone: faShieldHalved, descricao: 'Ajuste que ações são permitidas aos jogadores.', mestre: true },
  { id: 'fontes', rotulo: 'Fontes Adicionais', icone: faFont, descricao: 'Configure fontes adicionais que estarão disponíveis para uso nesta mesa.', mestre: true },
  { id: 'combate', rotulo: 'Monitor de Combate', icone: faXmarksLines, descricao: 'Configurações relacionadas ao Monitor de Combate.', mestre: true },
  { id: 'tempo', rotulo: 'Tempo e Calendário', icone: faClock, descricao: 'Relógio e calendário da campanha: o modo, o começo, quem vê, lua, estações e clima.', mestre: true },
]

// Configurações do Jogo (print do Foundry): busca à esquerda; à direita cada seção com o botão
// que abre a janela dela e a descrição embaixo.
export function ConfiguracoesDoJogo({ souMestre, onAbrir, onFechar }: { souMestre: boolean; onAbrir: (s: SecaoConfig) => void; onFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const secoes = SECOES.filter((s) => (souMestre || !s.mestre) && (!termo || `${s.rotulo} ${s.descricao}`.toLowerCase().includes(termo)))
  return (
    <Janela titulo="Configurações do Jogo" icone={faGears} largura={780} onFechar={onFechar}>
      <div className="config-jogo">
        <aside className="config-jogo-lado">
          <label className="config-jogo-busca">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input value={busca} aria-label="Procurar configurações" onChange={(e) => setBusca(e.target.value)} />
          </label>
          <div className="config-jogo-categoria">
            <span>Geral</span>
            <span>[{secoes.length}]</span>
          </div>
        </aside>
        <div className="config-jogo-lista">
          {secoes.map((s) => (
            <div key={s.id} className="config-jogo-linha">
              <strong>{s.rotulo}</strong>
              <button type="button" className="janela-botao" onClick={() => onAbrir(s.id)}>
                <FontAwesomeIcon icon={s.icone} /> {s.rotulo}
              </button>
              <p>{s.descricao}</p>
            </div>
          ))}
          {!secoes.length && <p className="item-vazio">Nada encontrado.</p>}
        </div>
      </div>
    </Janela>
  )
}

// Rodapé das janelas: Redefinir (volta ao padrão) e Salvar Alterações.
function Rodape({ onRedefinir, onSalvar, salvando }: { onRedefinir: () => void; onSalvar?: () => void; salvando?: boolean }) {
  return (
    <div className="config-rodape">
      <button type="button" className="janela-botao" onClick={onRedefinir}><FontAwesomeIcon icon={faRotateLeft} /> Redefinir</button>
      {onSalvar && (
        <button type="button" className="janela-botao" disabled={salvando} onClick={onSalvar}><FontAwesomeIcon icon={faFloppyDisk} /> {salvando ? 'Salvando…' : 'Salvar Alterações'}</button>
      )}
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="janela-grupo config-grupo">
      <legend>{titulo}</legend>
      {children}
    </fieldset>
  )
}

// ---- Interface de Usuário ----
export function JanelaInterface({ onFechar }: { onFechar: () => void }) {
  const [escala, setEscala] = useState(lerInterface().escala)
  const [loucura, setLoucura] = useState(lerInterface().loucura)
  const mudar = (v: number) => {
    setEscala(v)
    salvarInterface({ escala: v, loucura })
  }
  const mudarLoucura = (v: boolean) => {
    setLoucura(v)
    salvarInterface({ escala, loucura: v })
  }
  return (
    <Janela titulo="Configuração da Interface do Usuário" icone={faSwatchbook} largura={520} onFechar={onFechar}>
      <div className="janela-form">
        <Grupo titulo="Tamanho da Interface">
          <Campo rotulo="Escala da Interface" dica="Deixa painéis, janelas e textos maiores ou menores. O mapa não muda.">
            <Deslizante rotulo="Escala da Interface" valor={escala} min={0.75} max={1.4} passo={0.05} onMudar={mudar} />
          </Campo>
        </Grupo>
        <Grupo titulo="Efeitos na Tela">
          <label className="janela-check">
            <input type="checkbox" checked={loucura} onChange={(e) => mudarLoucura(e.target.checked)} />
            Sanidade e vida baixas mexem na tela (escurece, sangra, borra, o mapa derrete)
          </label>
        </Grupo>
        <Rodape onRedefinir={() => { setLoucura(true); setEscala(INTERFACE_PADRAO.escala); salvarInterface(INTERFACE_PADRAO) }} />
      </div>
    </Janela>
  )
}

// ---- Som ----
const CANAIS: { id: Canal; rotulo: string; dica: string }[] = [
  { id: 'musica', rotulo: 'Música', dica: 'As playlists de música.' },
  { id: 'ambiente', rotulo: 'Ambiente', dica: 'Os Sons Ambientes do mapa e as playlists de ambiente.' },
  { id: 'efeitos', rotulo: 'Efeitos Sonoros', dica: 'Dados, tiros, cliques da ficha.' },
]

export function JanelaSom({ onFechar }: { onFechar: () => void }) {
  const volumes = useVolumesDoUsuario()
  return (
    <Janela titulo="Som" icone={faVolumeHigh} largura={480} onFechar={onFechar}>
      <div className="janela-form">
        <Grupo titulo="Controles de Volume">
          {CANAIS.map((c) => (
            <Campo key={c.id} rotulo={c.rotulo} dica={c.dica}>
              <Deslizante rotulo={c.rotulo} valor={volumes[c.id]} min={0} max={1} onMudar={(v) => salvarVolume(c.id, v)} />
            </Campo>
          ))}
        </Grupo>
        <Rodape onRedefinir={() => CANAIS.forEach((c) => salvarVolume(c.id, VOLUMES_PADRAO[c.id]))} />
      </div>
    </Janela>
  )
}

// ---- Dados ----
export function JanelaDados({ estiloAtual, onSalvarEstilo, onFechar }: {
  estiloAtual: Partial<EstiloDados> | null | undefined
  onSalvarEstilo: (e: EstiloDados) => Promise<boolean>
  onFechar: () => void
}) {
  const [prefs, setPrefs] = useState<PreferenciasDados>(lerPreferenciasDados)
  const [estilo, setEstilo] = useState<EstiloDados>(() => estiloCompleto(estiloAtual))
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const mudarPrefs = (c: Partial<PreferenciasDados>) => {
    const n = { ...prefs, ...c }
    setPrefs(n)
    salvarPreferenciasDados(n)
  }
  const mudar = (c: Partial<EstiloDados>) => setEstilo((e) => ({ ...e, ...c }))
  return (
    <Janela titulo="Dados" icone={faDice} largura={540} onFechar={onFechar}>
      <div className="janela-form">
        <Grupo titulo="Na sua tela">
          <label className="janela-check">
            <input type="checkbox" checked={prefs.mostrar} onChange={(e) => mudarPrefs({ mostrar: e.target.checked })} />
            Mostrar os dados 3D caindo na mesa
          </label>
          <Campo rotulo="Tamanho dos dados">
            <Deslizante rotulo="Tamanho dos dados" valor={prefs.tamanho} min={0.5} max={1.6} passo={0.1} onMudar={(v) => mudarPrefs({ tamanho: v })} />
          </Campo>
          <Campo rotulo="Tempo na tela (segundos)" dica="Quanto os dados ficam parados antes de sumir.">
            <Deslizante rotulo="Tempo na tela" valor={prefs.tempo} min={1} max={8} passo={0.5} onMudar={(v) => mudarPrefs({ tempo: v })} />
          </Campo>
        </Grupo>

        <Grupo titulo="Aparência dos seus dados">
          <p className="config-dica">Todo mundo vê os dados que você rola desse jeito.</p>
          <Campo rotulo="Efeito" dica="A animação em volta dos dados. Os dados de elemento são especiais: vêm prontos, com a textura e as cores deles.">
            <select
              value={estilo.efeito}
              aria-label="Efeito"
              onChange={(e) => {
                const v = e.target.value as EstiloDados['efeito']
                const el = ELEMENTOS.find((x) => x.id === v)
                // Saindo de um elemento, volta pro dado padrão.
                setEstilo((x) => (el ? estiloCompleto({ efeito: v }) : ELEMENTOS.some((y) => y.id === x.efeito) ? { ...ESTILO_PADRAO, efeito: v } : { ...x, efeito: v }))
              }}
            >
              <option value="auto">Pela textura (fogo, estrelas, gelo…)</option>
              <option value="nenhum">Nenhum</option>
              {ELEMENTOS.map((x) => <option key={x.id} value={x.id as Elemento}>Dado de {x.rotulo}</option>)}
            </select>
          </Campo>
          {ELEMENTOS.some((x) => x.id === estilo.efeito) ? (
            <p className="config-dica">Dado especial do elemento: a textura, as cores e o número já vêm prontos.</p>
          ) : (
            <>
          <Campo rotulo="Cores">
            <div className="efeito-tipos" role="radiogroup" aria-label="Cores">
              <button type="button" role="radio" aria-checked={estilo.modo === 'tipo'} className={`janela-botao${estilo.modo === 'tipo' ? ' janela-botao-destaque' : ''}`} onClick={() => mudar({ modo: 'tipo' })}>Uma cor por tipo</button>
              <button type="button" role="radio" aria-checked={estilo.modo === 'unica'} className={`janela-botao${estilo.modo === 'unica' ? ' janela-botao-destaque' : ''}`} onClick={() => mudar({ modo: 'unica' })}>Todos iguais</button>
            </div>
          </Campo>
          {estilo.modo === 'unica' && (
            <Campo rotulo="Cor do dado"><CampoCor rotulo="Cor do dado" valor={estilo.cor} onMudar={(v) => mudar({ cor: v })} /></Campo>
          )}
          <Campo rotulo="Cor do número"><CampoCor rotulo="Cor do número" valor={estilo.numero} onMudar={(v) => mudar({ numero: v })} /></Campo>
          <Campo rotulo="Contorno do número"><CampoCor rotulo="Contorno do número" valor={estilo.contorno} onMudar={(v) => mudar({ contorno: v })} /></Campo>
          <Campo rotulo="Material">
            <select value={estilo.material} aria-label="Material" onChange={(e) => mudar({ material: e.target.value as MaterialDado })}>
              {MATERIAIS_DADO.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Textura">
            <select value={estilo.textura} aria-label="Textura" onChange={(e) => mudar({ textura: e.target.value })}>
              {TEXTURAS_DADO.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
            </select>
          </Campo>
            </>
          )}
          <button type="button" className="janela-botao" onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_TESTAR_DADOS, { detail: estilo }))}>
            <FontAwesomeIcon icon={faDice} /> Rolar de Teste
          </button>
        </Grupo>
        {aviso && <p className="janela-erro">{aviso}</p>}
        <Rodape
          salvando={salvando}
          onRedefinir={() => {
            setEstilo(ESTILO_PADRAO)
            mudarPrefs(PREFERENCIAS_PADRAO)
          }}
          onSalvar={async () => {
            setSalvando(true)
            setAviso(null)
            const ok = await onSalvarEstilo(estilo)
            setSalvando(false)
            if (ok) onFechar()
            else setAviso('Não deu pra salvar os seus dados.')
          }}
        />
      </div>
    </Janela>
  )
}

// ---- Chat ----
export function JanelaChat({ nomeAtual, onSalvar, onFechar }: { nomeAtual: string; onSalvar: (nome: string) => Promise<boolean>; onFechar: () => void }) {
  const [nome, setNome] = useState(nomeAtual)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  return (
    <Janela titulo="Chat" icone={faComment} largura={460} onFechar={onFechar}>
      <div className="janela-form">
        <Grupo titulo="Seu nome">
          <Campo rotulo="Nome no chat" dica="Aparece nas mensagens enviadas como você (não como personagem). É o nome da sua conta.">
            <input value={nome} maxLength={40} aria-label="Nome no chat" onChange={(e) => setNome(e.target.value)} />
          </Campo>
        </Grupo>
        {aviso && <p className="janela-erro">{aviso}</p>}
        <Rodape
          salvando={salvando}
          onRedefinir={() => setNome(nomeAtual)}
          onSalvar={async () => {
            if (!nome.trim()) return setAviso('O nome não pode ficar vazio.')
            setSalvando(true)
            const ok = await onSalvar(nome.trim())
            setSalvando(false)
            if (ok) onFechar()
            else setAviso('Não deu pra salvar o nome.')
          }}
        />
      </div>
    </Janela>
  )
}

// ---- Permissões de Usuários (mestre) ----
export function JanelaPermissoes({ atuais, onSalvar, onFechar }: { atuais: PermissoesCampanha; onSalvar: (p: PermissoesCampanha) => Promise<boolean>; onFechar: () => void }) {
  const [p, setP] = useState<PermissoesCampanha>(atuais)
  const [salvando, setSalvando] = useState(false)
  return (
    <Janela titulo="Configuração de Permissões de Usuários" icone={faShieldHalved} largura={620} onFechar={onFechar}>
      <div className="janela-form">
        <p className="config-dica">Configure o que os jogadores podem fazer. O mestre sempre pode tudo.</p>
        <table className="config-permissoes">
          <thead>
            <tr>
              <th>Permissão</th>
              <th>Jogador</th>
              <th>Mestre</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSOES.map((x) => (
              <tr key={x.id}>
                <td>
                  <strong>{x.rotulo}</strong>
                  <small>{x.descricao}</small>
                </td>
                <td><input type="checkbox" aria-label={`${x.rotulo}: jogador`} checked={p[x.id] !== false} onChange={(e) => setP({ ...p, [x.id]: e.target.checked })} /></td>
                <td><input type="checkbox" aria-label={`${x.rotulo}: mestre`} checked disabled /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Rodape
          salvando={salvando}
          onRedefinir={() => setP({})}
          onSalvar={async () => {
            setSalvando(true)
            const ok = await onSalvar(p)
            setSalvando(false)
            if (ok) onFechar()
          }}
        />
      </div>
    </Janela>
  )
}

// ---- Fontes Adicionais (mestre) ----
const FRASE = 'Dê já multa ao punk sexy que fez viação chegar à web.'

export function JanelaFontes({ config, onEnviarArquivo, onSalvar, onFechar }: {
  config: ConfigCampanha
  onEnviarArquivo: (f: File) => Promise<string | null>
  onSalvar: (c: ConfigCampanha) => Promise<boolean>
  onFechar: () => void
}) {
  const fontes = config.fontes ?? []
  const [nova, setNova] = useState<FonteAdicional>({ nome: '', url: '', peso: '400', estilo: 'normal' })
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const salvarLista = (l: FonteAdicional[]) => onSalvar({ ...config, fontes: l })

  async function enviar(f: File) {
    setEnviando(true)
    setAviso(null)
    const url = await onEnviarArquivo(f)
    setEnviando(false)
    if (!url) return setAviso('Não deu pra enviar o arquivo.')
    setNova((n) => ({ ...n, url, nome: n.nome || f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }))
  }

  return (
    <Janela titulo="Fontes Adicionais" icone={faFont} largura={560} onFechar={onFechar}>
      <div className="janela-form">
        <p className="config-fonte-previa" style={{ fontFamily: nova.nome ? `'${nova.nome}'` : undefined, fontWeight: Number(nova.peso), fontStyle: nova.estilo }}>{FRASE}</p>
        {fontes.length > 0 && (
          <ul className="config-fontes">
            {fontes.map((f, i) => (
              <li key={`${f.nome}-${i}`}>
                <span style={{ fontFamily: `'${f.nome}'`, fontWeight: Number(f.peso), fontStyle: f.estilo }}>{f.nome}</span>
                <small>{PESOS_FONTE.find((p) => p.id === f.peso)?.rotulo ?? f.peso}{f.estilo === 'italic' ? ' · Itálico' : ''}</small>
                <button type="button" className="combate-icone" aria-label={`Remover ${f.nome}`} title="Remover" onClick={() => salvarLista(fontes.filter((_, j) => j !== i))}><FontAwesomeIcon icon={faTrash} /></button>
              </li>
            ))}
          </ul>
        )}
        <Campo rotulo="Fonte" dica="O nome da fonte. Pra trocar a dos títulos do Diário, use “Modesto Condensed”.">
          <input value={nova.nome} aria-label="Nome da fonte" onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
        </Campo>
        <Campo rotulo="Peso da Fonte">
          <select value={nova.peso} aria-label="Peso da Fonte" onChange={(e) => setNova({ ...nova, peso: e.target.value })}>
            {PESOS_FONTE.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Estilo da Fonte">
          <select value={nova.estilo} aria-label="Estilo da Fonte" onChange={(e) => setNova({ ...nova, estilo: e.target.value as FonteAdicional['estilo'] })}>
            <option value="normal">Normal</option>
            <option value="italic">Itálico</option>
          </select>
        </Campo>
        <Campo rotulo="Arquivo de Fonte" dica=".ttf, .otf, .woff ou .woff2">
          <div className="diario-arquivo">
            <input value={nova.url} placeholder="path/to/file.ext" aria-label="Arquivo de Fonte" onChange={(e) => setNova({ ...nova, url: e.target.value.trim() })} />
            <label className="janela-botao" title="Enviar arquivo">
              <FontAwesomeIcon icon={faUpload} /> {enviando ? 'Enviando…' : 'Enviar'}
              <input type="file" hidden accept=".ttf,.otf,.woff,.woff2,font/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviar(f) }} />
            </label>
          </div>
        </Campo>
        {aviso && <p className="janela-erro">{aviso}</p>}
        <button
          type="button"
          className="janela-botao"
          disabled={!nova.nome.trim() || !nova.url || enviando}
          onClick={async () => {
            if (await salvarLista([...fontes, { ...nova, nome: nova.nome.trim() }])) setNova({ nome: '', url: '', peso: '400', estilo: 'normal' })
          }}
        >
          <FontAwesomeIcon icon={faPlus} /> Adicionar Fonte
        </button>
      </div>
    </Janela>
  )
}

// ---- Monitor de Combate (mestre) ----
export function JanelaCombate({ config, onSalvar, onFechar }: { config: ConfigCampanha; onSalvar: (c: ConfigCampanha) => Promise<boolean>; onFechar: () => void }) {
  const [c, setC] = useState(combateDa(config))
  const [salvando, setSalvando] = useState(false)
  return (
    <Janela titulo="Monitor de Combate" icone={faXmarksLines} largura={500} onFechar={onFechar}>
      <div className="janela-form">
        <Grupo titulo="Carrossel de Turno">
          <label className="janela-check">
            <input type="checkbox" checked={c.vidaNoCarrossel} onChange={(e) => setC({ ...c, vidaNoCarrossel: e.target.checked })} />
            Mostrar a vida dos jogadores embaixo dos cards
          </label>
        </Grupo>
        <Grupo titulo="Morrendo">
          <label className="janela-check">
            <input type="checkbox" checked={c.caveirasAutomaticas} onChange={(e) => setC({ ...c, caveirasAutomaticas: e.target.checked })} />
            Marcar uma caveira sozinho quando começa a vez de quem está com 0 de vida
          </label>
        </Grupo>
        <Rodape
          salvando={salvando}
          onRedefinir={() => setC({ vidaNoCarrossel: true, caveirasAutomaticas: true })}
          onSalvar={async () => {
            setSalvando(true)
            const ok = await onSalvar({ ...config, combate: c })
            setSalvando(false)
            if (ok) onFechar()
          }}
        />
      </div>
    </Janela>
  )
}

// ---- Controles (atalhos) ----
export function JanelaControles({ souMestre, onFechar }: { souMestre: boolean; onFechar: () => void }) {
  return (
    <Janela titulo="Controles" icone={faGamepad} largura={560} onFechar={onFechar}>
      <div className="janela-form config-controles">
        {ATALHOS.filter((g) => souMestre || g.itens.some((i) => !i.mestre)).map((g) => (
          <Grupo key={g.grupo} titulo={g.grupo}>
            <dl>
              {g.itens.filter((i) => souMestre || !i.mestre).map((i) => (
                <div key={i.teclas}>
                  <dt><kbd>{i.teclas}</kbd></dt>
                  <dd>{i.acao}</dd>
                </div>
              ))}
            </dl>
          </Grupo>
        ))}
      </div>
    </Janela>
  )
}

// ---- Configuração do Mundo (mestre) ----
export function JanelaMundo({ nome, cor, onSalvar, onFechar }: {
  nome: string
  cor: string | null
  onSalvar: (c: { name: string; accent_color: string | null }) => Promise<boolean>
  onFechar: () => void
}) {
  const [n, setN] = useState(nome)
  const [c, setC] = useState(cor ?? '#e6e6ea')
  const [salvando, setSalvando] = useState(false)
  return (
    <Janela titulo="Configuração do Mundo" icone={faGlobe} largura={480} onFechar={onFechar}>
      <div className="janela-form">
        <Campo rotulo="Nome da Campanha">
          <input value={n} aria-label="Nome da Campanha" onChange={(e) => setN(e.target.value)} />
        </Campo>
        <Campo rotulo="Cor da Mesa" dica="A cor de destaque: o que está selecionado, os dados marcados, as linhas do Diário.">
          <CampoCor rotulo="Cor da Mesa" valor={c} onMudar={setC} />
        </Campo>
        <Rodape
          salvando={salvando}
          onRedefinir={() => { setN(nome); setC('#e6e6ea') }}
          onSalvar={async () => {
            setSalvando(true)
            const ok = await onSalvar({ name: n.trim() || nome, accent_color: c })
            setSalvando(false)
            if (ok) onFechar()
          }}
        />
      </div>
    </Janela>
  )
}

// ---- Usuários (mestre) ----
export function JanelaUsuarios({ membros, onRemover, onFechar }: {
  membros: { userId: string; papel: 'mestre' | 'jogador'; nomeConta: string; personagem: string | null; fotoConta?: string | null }[]
  onRemover: (userId: string) => void
  onFechar: () => void
}) {
  return (
    <Janela titulo="Usuários" icone={faUsers} largura={480} onFechar={onFechar}>
      <ul className="config-usuarios">
        {membros.map((m) => (
          <li key={m.userId}>
            <span className="ator-token">{m.fotoConta ? <img src={m.fotoConta} alt="" /> : <FontAwesomeIcon icon={faUsers} />}</span>
            <span className="config-usuario-nome">
              <strong>{m.nomeConta}</strong>
              <small>{m.papel === 'mestre' ? 'Mestre do Jogo' : `Jogador${m.personagem ? ` · ${m.personagem}` : ''}`}</small>
            </span>
            {m.papel !== 'mestre' && (
              <button type="button" className="combate-icone" title="Tirar da campanha" aria-label={`Tirar ${m.nomeConta} da campanha`} onClick={() => window.confirm(`Tirar ${m.nomeConta} da campanha? A pessoa pode entrar de novo pelo link de convite.`) && onRemover(m.userId)}>
                <FontAwesomeIcon icon={faUserMinus} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Janela>
  )
}
