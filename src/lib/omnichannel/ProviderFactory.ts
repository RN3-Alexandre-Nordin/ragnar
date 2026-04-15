import { EvolutionProvider } from './providers/EvolutionProvider';
import { BaseProvider } from '@/types/omnichannel';

export class ProviderFactory {
  /**
   * Retorna o provedor de comunicação correspondente ao slug informado.
   */
  static getProvider(slug: string): BaseProvider | null {
    switch (slug.toLowerCase()) {
      case 'evolution':
        return new EvolutionProvider();
      // Futuros canais
      // case 'meta': return new MetaProvider();
      // case 'instagram': return new InstagramProvider();
      default:
        return null;
    }
  }
}
