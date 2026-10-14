import { recortarImagem } from '../../components/RecortarImagem'

// Abre o seletor de arquivo do sistema e devolve o escolhido (ou null se a pessoa desistiu).
export function escolherArquivo(accept: string): Promise<File | null> {
  return new Promise((resolver) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolver(input.files?.[0] ?? null)
    // Fechou o seletor sem escolher: o foco volta pra janela.
    window.addEventListener('focus', () => setTimeout(() => { if (!input.files?.length) resolver(null) }, 400), { once: true })
    input.click()
  })
}

// Imagem com o recorte do site (foto de perfil quadrada, papel de parede em retrato).
export async function escolherImagem(proporcao: 'quadrado' | 'retrato' | 'original', titulo: string): Promise<File | null> {
  const f = await escolherArquivo('image/*')
  if (!f) return null
  return recortarImagem(f, { proporcao, titulo })
}

export function tipoDoArquivo(f: File): 'foto' | 'video' | 'audio' | 'arquivo' {
  if (f.type.startsWith('image/')) return 'foto'
  if (f.type.startsWith('video/')) return 'video'
  if (f.type.startsWith('audio/')) return 'audio'
  return 'arquivo'
}
