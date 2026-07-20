export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_comunicacoes: {
        Row: {
          criado_em: string
          enviado_por: string
          id: string
          link: string | null
          mensagem: string
          publico: string
          quantidade_enviada: number
          titulo: string
        }
        Insert: {
          criado_em?: string
          enviado_por: string
          id?: string
          link?: string | null
          mensagem: string
          publico: string
          quantidade_enviada?: number
          titulo: string
        }
        Update: {
          criado_em?: string
          enviado_por?: string
          id?: string
          link?: string | null
          mensagem?: string
          publico?: string
          quantidade_enviada?: number
          titulo?: string
        }
        Relationships: []
      }
      admin_config: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string | null
          id: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao?: string | null
          id?: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string | null
          id?: string
          valor?: string
        }
        Relationships: []
      }
      admin_financeiro: {
        Row: {
          criado_em: string
          data_lancamento: string
          descricao: string | null
          id: string
          origem: string
          referencia_id: string | null
          tipo: string
          user_id: string | null
          valor: number
        }
        Insert: {
          criado_em?: string
          data_lancamento?: string
          descricao?: string | null
          id?: string
          origem: string
          referencia_id?: string | null
          tipo: string
          user_id?: string | null
          valor: number
        }
        Update: {
          criado_em?: string
          data_lancamento?: string
          descricao?: string | null
          id?: string
          origem?: string
          referencia_id?: string | null
          tipo?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      admin_log: {
        Row: {
          acao: string
          admin_id: string
          alvo_id: string | null
          alvo_tabela: string | null
          criado_em: string
          detalhes: Json | null
          id: string
        }
        Insert: {
          acao: string
          admin_id: string
          alvo_id?: string | null
          alvo_tabela?: string | null
          criado_em?: string
          detalhes?: Json | null
          id?: string
        }
        Update: {
          acao?: string
          admin_id?: string
          alvo_id?: string | null
          alvo_tabela?: string | null
          criado_em?: string
          detalhes?: Json | null
          id?: string
        }
        Relationships: []
      }
      ads_anunciantes: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_whatsapp: string | null
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_whatsapp?: string | null
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_whatsapp?: string | null
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      ads_campanhas: {
        Row: {
          anunciante_id: string
          criado_em: string
          data_fim: string
          data_inicio: string
          frequencia_exibicao: number
          grupos_alvo: Json | null
          id: string
          nome: string
          publico_alvo: string
          segmentacao_tipo: string
          segmentacao_valor: Json
          status: string
          telas: string[]
          tipo: string
        }
        Insert: {
          anunciante_id: string
          criado_em?: string
          data_fim: string
          data_inicio: string
          frequencia_exibicao?: number
          grupos_alvo?: Json | null
          id?: string
          nome: string
          publico_alvo?: string
          segmentacao_tipo?: string
          segmentacao_valor?: Json
          status?: string
          telas?: string[]
          tipo: string
        }
        Update: {
          anunciante_id?: string
          criado_em?: string
          data_fim?: string
          data_inicio?: string
          frequencia_exibicao?: number
          grupos_alvo?: Json | null
          id?: string
          nome?: string
          publico_alvo?: string
          segmentacao_tipo?: string
          segmentacao_valor?: Json
          status?: string
          telas?: string[]
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_campanhas_anunciante_id_fkey"
            columns: ["anunciante_id"]
            isOneToOne: false
            referencedRelation: "ads_anunciantes"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_cliques: {
        Row: {
          campanha_id: string
          criado_em: string
          criativo_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          campanha_id: string
          criado_em?: string
          criativo_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          campanha_id?: string
          criado_em?: string
          criativo_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_cliques_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "ads_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_cliques_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "ads_criativos"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_criativos: {
        Row: {
          altura: number | null
          ativo: boolean
          campanha_id: string
          criado_em: string
          id: string
          largura: number | null
          tipo: string
          url_arquivo: string
          url_destino: string | null
        }
        Insert: {
          altura?: number | null
          ativo?: boolean
          campanha_id: string
          criado_em?: string
          id?: string
          largura?: number | null
          tipo: string
          url_arquivo: string
          url_destino?: string | null
        }
        Update: {
          altura?: number | null
          ativo?: boolean
          campanha_id?: string
          criado_em?: string
          id?: string
          largura?: number | null
          tipo?: string
          url_arquivo?: string
          url_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_criativos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "ads_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_impressoes: {
        Row: {
          campanha_id: string
          cidade: string | null
          criado_em: string
          criativo_id: string | null
          estado: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          campanha_id: string
          cidade?: string | null
          criado_em?: string
          criativo_id?: string | null
          estado?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          campanha_id?: string
          cidade?: string | null
          criado_em?: string
          criativo_id?: string | null
          estado?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_impressoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "ads_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_impressoes_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "ads_criativos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          arena_id: string
          atualizado_em: string
          capitao_id: string
          criado_em: string
          data: string
          forma_pagamento: string | null
          grupo_id: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          observacoes: string | null
          quadra_id: string
          status: string
          valor_cobrado: number | null
        }
        Insert: {
          arena_id: string
          atualizado_em?: string
          capitao_id: string
          criado_em?: string
          data: string
          forma_pagamento?: string | null
          grupo_id?: string | null
          horario_fim: string
          horario_inicio: string
          id?: string
          observacoes?: string | null
          quadra_id: string
          status?: string
          valor_cobrado?: number | null
        }
        Update: {
          arena_id?: string
          atualizado_em?: string
          capitao_id?: string
          criado_em?: string
          data?: string
          forma_pagamento?: string | null
          grupo_id?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          observacoes?: string | null
          quadra_id?: string
          status?: string
          valor_cobrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_quadra_id_fkey"
            columns: ["quadra_id"]
            isOneToOne: false
            referencedRelation: "quadras"
            referencedColumns: ["id"]
          },
        ]
      }
      arenas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cep: string | null
          cidade: string | null
          cnpj_cpf: string | null
          criado_em: string
          endereco: string | null
          estado: string | null
          foto_capa_url: string | null
          horario_funcionamento: Json | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          nome: string
          plano: string
          plano_validade: string | null
          slug: string
          telefone: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          criado_em?: string
          endereco?: string | null
          estado?: string | null
          foto_capa_url?: string | null
          horario_funcionamento?: Json | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome: string
          plano?: string
          plano_validade?: string | null
          slug: string
          telefone?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          criado_em?: string
          endereco?: string | null
          estado?: string | null
          foto_capa_url?: string | null
          horario_funcionamento?: Json | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome?: string
          plano?: string
          plano_validade?: string | null
          slug?: string
          telefone?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      auxiliares_partida: {
        Row: {
          criado_em: string
          id: string
          partida_id: string
          pelada_id: string
          time_fora_id: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          partida_id: string
          pelada_id: string
          time_fora_id?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          partida_id?: string
          pelada_id?: string
          time_fora_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auxiliares_partida_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: true
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auxiliares_partida_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auxiliares_partida_time_fora_id_fkey"
            columns: ["time_fora_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_pos_pelada: {
        Row: {
          avaliado_id: string
          avaliador_id: string
          criado_em: string
          defesas_confirmadas: number
          gols_confirmados: number
          id: string
          nota_comportamento: number
          nota_geral: number
          passes_confirmados: number
          pelada_id: string
        }
        Insert: {
          avaliado_id: string
          avaliador_id: string
          criado_em?: string
          defesas_confirmadas?: number
          gols_confirmados?: number
          id?: string
          nota_comportamento: number
          nota_geral: number
          passes_confirmados?: number
          pelada_id: string
        }
        Update: {
          avaliado_id?: string
          avaliador_id?: string
          criado_em?: string
          defesas_confirmadas?: number
          gols_confirmados?: number
          id?: string
          nota_comportamento?: number
          nota_geral?: number
          passes_confirmados?: number
          pelada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_pos_pelada_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_skill_membro: {
        Row: {
          avaliado_id: string
          avaliador_id: string
          chute: number | null
          conhece_jogador: boolean
          criado_em: string
          drible: number | null
          grupo_id: string
          id: string
          nota_desempenho_geral: number | null
          passe: number | null
          pelada_id: string | null
          posicionamento: number | null
          resistencia: number | null
          tipo: string
          velocidade: number | null
        }
        Insert: {
          avaliado_id: string
          avaliador_id: string
          chute?: number | null
          conhece_jogador?: boolean
          criado_em?: string
          drible?: number | null
          grupo_id: string
          id?: string
          nota_desempenho_geral?: number | null
          passe?: number | null
          pelada_id?: string | null
          posicionamento?: number | null
          resistencia?: number | null
          tipo: string
          velocidade?: number | null
        }
        Update: {
          avaliado_id?: string
          avaliador_id?: string
          chute?: number | null
          conhece_jogador?: boolean
          criado_em?: string
          drible?: number | null
          grupo_id?: string
          id?: string
          nota_desempenho_geral?: number | null
          passe?: number | null
          pelada_id?: string | null
          posicionamento?: number | null
          resistencia?: number | null
          tipo?: string
          velocidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_skill_membro_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_skill_membro_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_agenda: {
        Row: {
          criado_em: string
          data: string
          horario_fim: string
          horario_inicio: string
          id: string
          motivo: string | null
          quadra_id: string
        }
        Insert: {
          criado_em?: string
          data: string
          horario_fim: string
          horario_inicio: string
          id?: string
          motivo?: string | null
          quadra_id: string
        }
        Update: {
          criado_em?: string
          data?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          motivo?: string | null
          quadra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_agenda_quadra_id_fkey"
            columns: ["quadra_id"]
            isOneToOne: false
            referencedRelation: "quadras"
            referencedColumns: ["id"]
          },
        ]
      }
      capitao_status_log: {
        Row: {
          criado_em: string
          evento: string
          id: string
          motivo: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          evento: string
          id?: string
          motivo?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          evento?: string
          id?: string
          motivo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cashback_config: {
        Row: {
          aplicar_em: string
          arena_id: string
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          percentual: number
          validade_dias: number | null
        }
        Insert: {
          aplicar_em?: string
          arena_id: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          percentual?: number
          validade_dias?: number | null
        }
        Update: {
          aplicar_em?: string
          arena_id?: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          percentual?: number
          validade_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cashback_config_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: true
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_historico: {
        Row: {
          arena_id: string
          criado_em: string
          id: string
          origem: string
          origem_id: string | null
          saldo_apos: number
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          arena_id: string
          criado_em?: string
          id?: string
          origem: string
          origem_id?: string | null
          saldo_apos: number
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          arena_id?: string
          criado_em?: string
          id?: string
          origem?: string
          origem_id?: string | null
          saldo_apos?: number
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cashback_historico_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_saldo: {
        Row: {
          arena_id: string
          atualizado_em: string
          id: string
          saldo: number
          user_id: string
        }
        Insert: {
          arena_id: string
          atualizado_em?: string
          id?: string
          saldo?: number
          user_id: string
        }
        Update: {
          arena_id?: string
          atualizado_em?: string
          id?: string
          saldo?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashback_saldo_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_grupo: {
        Row: {
          capitao_id: string
          convidado_id: string
          criado_em: string
          expira_em: string
          grupo_id: string
          id: string
          respondido_em: string | null
          status: string
        }
        Insert: {
          capitao_id: string
          convidado_id: string
          criado_em?: string
          expira_em?: string
          grupo_id: string
          id?: string
          respondido_em?: string | null
          status?: string
        }
        Update: {
          capitao_id?: string
          convidado_id?: string
          criado_em?: string
          expira_em?: string
          grupo_id?: string
          id?: string
          respondido_em?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_grupo_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_indicacao: {
        Row: {
          ativo: boolean
          cadastrou: boolean
          codigo_unico: string
          convidado_id: string | null
          criado_em: string
          grupo_id: string
          id: string
          indicador_id: string
          jogou_primeira_pelada: boolean
          pontos_creditados: boolean
          tipo_indicador: string
        }
        Insert: {
          ativo?: boolean
          cadastrou?: boolean
          codigo_unico: string
          convidado_id?: string | null
          criado_em?: string
          grupo_id: string
          id?: string
          indicador_id: string
          jogou_primeira_pelada?: boolean
          pontos_creditados?: boolean
          tipo_indicador: string
        }
        Update: {
          ativo?: boolean
          cadastrou?: boolean
          codigo_unico?: string
          convidado_id?: string | null
          criado_em?: string
          grupo_id?: string
          id?: string
          indicador_id?: string
          jogou_primeira_pelada?: boolean
          pontos_creditados?: boolean
          tipo_indicador?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_indicacao_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      desafios: {
        Row: {
          acao_alvo: string
          ativo: boolean
          criado_em: string
          descricao: string | null
          id: string
          pontos_recompensa: number
          quantidade_alvo: number
          tipo: string
          titulo: string
        }
        Insert: {
          acao_alvo: string
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          id?: string
          pontos_recompensa: number
          quantidade_alvo: number
          tipo?: string
          titulo: string
        }
        Update: {
          acao_alvo?: string
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          id?: string
          pontos_recompensa?: number
          quantidade_alvo?: number
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      desafios_progresso: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          desafio_id: string
          id: string
          periodo_referencia: string
          progresso_atual: number
          user_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          desafio_id: string
          id?: string
          periodo_referencia: string
          progresso_atual?: number
          user_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          desafio_id?: string
          id?: string
          periodo_referencia?: string
          progresso_atual?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafios_progresso_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comentarios: {
        Row: {
          criado_em: string
          deletado: boolean
          id: string
          post_id: string
          texto: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          deletado?: boolean
          id?: string
          post_id: string
          texto: string
          user_id: string
        }
        Update: {
          criado_em?: string
          deletado?: boolean
          id?: string
          post_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comentarios_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          conteudo: Json
          criado_em: string
          grupo_id: string | null
          id: string
          pelada_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          conteudo?: Json
          criado_em?: string
          grupo_id?: string | null
          id?: string
          pelada_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          conteudo?: Json
          criado_em?: string
          grupo_id?: string | null
          id?: string
          pelada_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reacoes: {
        Row: {
          criado_em: string
          id: string
          post_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          post_id: string
          tipo: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          post_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reacoes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          arena_id: string
          categoria: string | null
          criado_em: string
          data_lancamento: string
          descricao: string
          id: string
          origem: string
          origem_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          arena_id: string
          categoria?: string | null
          criado_em?: string
          data_lancamento?: string
          descricao: string
          id?: string
          origem?: string
          origem_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          arena_id?: string
          categoria?: string | null
          criado_em?: string
          data_lancamento?: string
          descricao?: string
          id?: string
          origem?: string
          origem_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      goleiros_avaliacoes: {
        Row: {
          avaliador_id: string
          criado_em: string
          goleiro_id: string
          id: string
          nota: number
          pelada_id: string
        }
        Insert: {
          avaliador_id: string
          criado_em?: string
          goleiro_id: string
          id?: string
          nota: number
          pelada_id: string
        }
        Update: {
          avaliador_id?: string
          criado_em?: string
          goleiro_id?: string
          id?: string
          nota?: number
          pelada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goleiros_avaliacoes_goleiro_id_fkey"
            columns: ["goleiro_id"]
            isOneToOne: false
            referencedRelation: "goleiros_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goleiros_avaliacoes_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      goleiros_bloqueios: {
        Row: {
          criado_em: string
          data: string
          goleiro_id: string
          horario_fim: string
          horario_inicio: string
          id: string
          motivo: string
          origem_id: string | null
        }
        Insert: {
          criado_em?: string
          data: string
          goleiro_id: string
          horario_fim: string
          horario_inicio: string
          id?: string
          motivo: string
          origem_id?: string | null
        }
        Update: {
          criado_em?: string
          data?: string
          goleiro_id?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          motivo?: string
          origem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goleiros_bloqueios_goleiro_id_fkey"
            columns: ["goleiro_id"]
            isOneToOne: false
            referencedRelation: "goleiros_perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      goleiros_convites: {
        Row: {
          arena_nome: string | null
          capitao_id: string
          criado_em: string
          data: string
          goleiro_id: string
          horario_fim: string
          horario_inicio: string
          id: string
          mensagem: string | null
          motivo_recusa: string | null
          pelada_id: string | null
          respondido_em: string | null
          status: string
          valor_combinado: number | null
        }
        Insert: {
          arena_nome?: string | null
          capitao_id: string
          criado_em?: string
          data: string
          goleiro_id: string
          horario_fim: string
          horario_inicio: string
          id?: string
          mensagem?: string | null
          motivo_recusa?: string | null
          pelada_id?: string | null
          respondido_em?: string | null
          status?: string
          valor_combinado?: number | null
        }
        Update: {
          arena_nome?: string | null
          capitao_id?: string
          criado_em?: string
          data?: string
          goleiro_id?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          mensagem?: string | null
          motivo_recusa?: string | null
          pelada_id?: string | null
          respondido_em?: string | null
          status?: string
          valor_combinado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goleiros_convites_goleiro_id_fkey"
            columns: ["goleiro_id"]
            isOneToOne: false
            referencedRelation: "goleiros_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goleiros_convites_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      goleiros_disponibilidade: {
        Row: {
          criado_em: string
          dia_semana: number
          goleiro_id: string
          horario_fim: string
          horario_inicio: string
          id: string
        }
        Insert: {
          criado_em?: string
          dia_semana: number
          goleiro_id: string
          horario_fim: string
          horario_inicio: string
          id?: string
        }
        Update: {
          criado_em?: string
          dia_semana?: number
          goleiro_id?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goleiros_disponibilidade_goleiro_id_fkey"
            columns: ["goleiro_id"]
            isOneToOne: false
            referencedRelation: "goleiros_perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      goleiros_perfil: {
        Row: {
          ativo_catalogo: boolean
          atualizado_em: string
          bio: string | null
          criado_em: string
          id: string
          tipos_quadra: string[]
          user_id: string
          valor_hora: number
        }
        Insert: {
          ativo_catalogo?: boolean
          atualizado_em?: string
          bio?: string | null
          criado_em?: string
          id?: string
          tipos_quadra?: string[]
          user_id: string
          valor_hora?: number
        }
        Update: {
          ativo_catalogo?: boolean
          atualizado_em?: string
          bio?: string | null
          criado_em?: string
          id?: string
          tipos_quadra?: string[]
          user_id?: string
          valor_hora?: number
        }
        Relationships: []
      }
      grupo_membros: {
        Row: {
          entrou_em: string
          grupo_id: string
          id: string
          papel: Database["public"]["Enums"]["papel_membro"]
          status: Database["public"]["Enums"]["status_membro"]
          user_id: string
        }
        Insert: {
          entrou_em?: string
          grupo_id: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_membro"]
          status?: Database["public"]["Enums"]["status_membro"]
          user_id: string
        }
        Update: {
          entrou_em?: string
          grupo_id?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_membro"]
          status?: Database["public"]["Enums"]["status_membro"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          codigo_convite: string
          criado_em: string
          criado_por: string
          id: string
          nome: string
          permite_membros_convidarem: boolean
          permitir_membros_convidar: boolean
        }
        Insert: {
          codigo_convite: string
          criado_em?: string
          criado_por: string
          id?: string
          nome: string
          permite_membros_convidarem?: boolean
          permitir_membros_convidar?: boolean
        }
        Update: {
          codigo_convite?: string
          criado_em?: string
          criado_por?: string
          id?: string
          nome?: string
          permite_membros_convidarem?: boolean
          permitir_membros_convidar?: boolean
        }
        Relationships: []
      }
      lances: {
        Row: {
          criado_em: string
          descricao: string | null
          id: string
          marcado_por: string
          partida_id: string
          pelada_id: string
          time_id: string
          tipo: Database["public"]["Enums"]["tipo_lance"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: string
          marcado_por: string
          partida_id: string
          pelada_id: string
          time_id: string
          tipo: Database["public"]["Enums"]["tipo_lance"]
          user_id: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: string
          marcado_por?: string
          partida_id?: string
          pelada_id?: string
          time_id?: string
          tipo?: Database["public"]["Enums"]["tipo_lance"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lances_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lances_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lances_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      lances_auditoria: {
        Row: {
          acao: string
          dado_anterior: Json | null
          feito_em: string
          feito_por: string
          id: string
          lance_id: string | null
          pelada_id: string
        }
        Insert: {
          acao: string
          dado_anterior?: Json | null
          feito_em?: string
          feito_por: string
          id?: string
          lance_id?: string | null
          pelada_id: string
        }
        Update: {
          acao?: string
          dado_anterior?: Json | null
          feito_em?: string
          feito_por?: string
          id?: string
          lance_id?: string | null
          pelada_id?: string
        }
        Relationships: []
      }
      mvp_votos: {
        Row: {
          criado_em: string
          id: string
          pelada_id: string
          votado_id: string
          votante_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          pelada_id: string
          votado_id: string
          votante_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          pelada_id?: string
          votado_id?: string
          votante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_votos_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          dados_extras: Json | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          dados_extras?: Json | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          criado_em?: string
          dados_extras?: Json | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      ofensivas: {
        Row: {
          atualizado_em: string
          id: string
          maior_sequencia: number
          sequencia_atual: number
          ultima_pelada_em: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          id?: string
          maior_sequencia?: number
          sequencia_atual?: number
          ultima_pelada_em?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          id?: string
          maior_sequencia?: number
          sequencia_atual?: number
          ultima_pelada_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      parceiros: {
        Row: {
          ativo: boolean
          categoria: string
          cep: string | null
          cidade: string | null
          criado_em: string
          descricao: string | null
          endereco: string | null
          estado: string | null
          foto_capa_url: string | null
          google_maps_url: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          nome_estabelecimento: string
          plano: string
          plano_validade: string | null
          slug: string
          telefone: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          cep?: string | null
          cidade?: string | null
          criado_em?: string
          descricao?: string | null
          endereco?: string | null
          estado?: string | null
          foto_capa_url?: string | null
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome_estabelecimento: string
          plano?: string
          plano_validade?: string | null
          slug: string
          telefone?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cep?: string | null
          cidade?: string | null
          criado_em?: string
          descricao?: string | null
          endereco?: string | null
          estado?: string | null
          foto_capa_url?: string | null
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome_estabelecimento?: string
          plano?: string
          plano_validade?: string | null
          slug?: string
          telefone?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      parceiros_cliques: {
        Row: {
          criado_em: string
          id: string
          parceiro_id: string
          recompensa_id: string
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          parceiro_id: string
          recompensa_id: string
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          parceiro_id?: string
          recompensa_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_cliques_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiros_cliques_recompensa_id_fkey"
            columns: ["recompensa_id"]
            isOneToOne: false
            referencedRelation: "parceiros_recompensas"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_recompensas: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          foto_url: string | null
          id: string
          nome: string
          parceiro_id: string
          pontos_necessarios: number
          quantidade_disponivel: number | null
          quantidade_resgatada: number
          regras: string | null
          tipo: string
          valor_real: number
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          parceiro_id: string
          pontos_necessarios?: number
          quantidade_disponivel?: number | null
          quantidade_resgatada?: number
          regras?: string | null
          tipo?: string
          valor_real?: number
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          parceiro_id?: string
          pontos_necessarios?: number
          quantidade_disponivel?: number | null
          quantidade_resgatada?: number
          regras?: string | null
          tipo?: string
          valor_real?: number
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_recompensas_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_resgates: {
        Row: {
          codigo_validacao: string
          confirmado_em: string | null
          expira_em: string
          id: string
          parceiro_id: string
          pontos_debitados: number
          recompensa_id: string
          solicitado_em: string
          status: string
          user_id: string
        }
        Insert: {
          codigo_validacao: string
          confirmado_em?: string | null
          expira_em?: string
          id?: string
          parceiro_id: string
          pontos_debitados: number
          recompensa_id: string
          solicitado_em?: string
          status?: string
          user_id: string
        }
        Update: {
          codigo_validacao?: string
          confirmado_em?: string | null
          expira_em?: string
          id?: string
          parceiro_id?: string
          pontos_debitados?: number
          recompensa_id?: string
          solicitado_em?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_resgates_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiros_resgates_recompensa_id_fkey"
            columns: ["recompensa_id"]
            isOneToOne: false
            referencedRelation: "parceiros_recompensas"
            referencedColumns: ["id"]
          },
        ]
      }
      partida_goleiros_fixos: {
        Row: {
          criado_em: string
          goleiro_user_id: string
          id: string
          partida_id: string
          pelada_id: string
          time_id: string | null
        }
        Insert: {
          criado_em?: string
          goleiro_user_id: string
          id?: string
          partida_id: string
          pelada_id: string
          time_id?: string | null
        }
        Update: {
          criado_em?: string
          goleiro_user_id?: string
          id?: string
          partida_id?: string
          pelada_id?: string
          time_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partida_goleiros_fixos_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partida_goleiros_fixos_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partida_goleiros_fixos_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      partidas: {
        Row: {
          criado_em: string
          duracao_minutos: number
          encerrada_em: string | null
          id: string
          iniciada_em: string | null
          numero_partida: number
          pelada_id: string
          placar_a: number
          placar_b: number
          status: Database["public"]["Enums"]["status_partida"]
          time_a_id: string
          time_b_id: string
          time_fora_id: string | null
        }
        Insert: {
          criado_em?: string
          duracao_minutos?: number
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          numero_partida: number
          pelada_id: string
          placar_a?: number
          placar_b?: number
          status?: Database["public"]["Enums"]["status_partida"]
          time_a_id: string
          time_b_id: string
          time_fora_id?: string | null
        }
        Update: {
          criado_em?: string
          duracao_minutos?: number
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          numero_partida?: number
          pelada_id?: string
          placar_a?: number
          placar_b?: number
          status?: Database["public"]["Enums"]["status_partida"]
          time_a_id?: string
          time_b_id?: string
          time_fora_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidas_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_time_a_id_fkey"
            columns: ["time_a_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_time_b_id_fkey"
            columns: ["time_b_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_time_fora_id_fkey"
            columns: ["time_fora_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_categorias: {
        Row: {
          arena_id: string
          ativo: boolean
          codigo: number
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          arena_id: string
          ativo?: boolean
          codigo: number
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          arena_id?: string
          ativo?: boolean
          codigo?: number
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_categorias_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_itens_venda: {
        Row: {
          id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          id?: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Update: {
          id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "pdv_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "pdv_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_produtos: {
        Row: {
          arena_id: string
          ativo: boolean
          categoria_id: string
          codigo: number
          criado_em: string
          estoque_atual: number
          estoque_minimo: number
          foto_url: string | null
          id: string
          nome: string
          preco: number
        }
        Insert: {
          arena_id: string
          ativo?: boolean
          categoria_id: string
          codigo: number
          criado_em?: string
          estoque_atual?: number
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          nome: string
          preco?: number
        }
        Update: {
          arena_id?: string
          ativo?: boolean
          categoria_id?: string
          codigo?: number
          criado_em?: string
          estoque_atual?: number
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          nome?: string
          preco?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdv_produtos_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "pdv_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_vendas: {
        Row: {
          arena_id: string
          cashback_utilizado: number
          criado_em: string
          forma_pagamento: string
          id: string
          operador_id: string
          total: number
          usuario_id: string | null
        }
        Insert: {
          arena_id: string
          cashback_utilizado?: number
          criado_em?: string
          forma_pagamento: string
          id?: string
          operador_id: string
          total?: number
          usuario_id?: string | null
        }
        Update: {
          arena_id?: string
          cashback_utilizado?: number
          criado_em?: string
          forma_pagamento?: string
          id?: string
          operador_id?: string
          total?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdv_vendas_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      pelada_confirmacoes: {
        Row: {
          atualizado_em: string
          confirmado_em: string
          id: string
          pelada_id: string
          status: Database["public"]["Enums"]["status_confirmacao"]
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          confirmado_em?: string
          id?: string
          pelada_id: string
          status?: Database["public"]["Enums"]["status_confirmacao"]
          user_id: string
        }
        Update: {
          atualizado_em?: string
          confirmado_em?: string
          id?: string
          pelada_id?: string
          status?: Database["public"]["Enums"]["status_confirmacao"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pelada_confirmacoes_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      pelada_convidados: {
        Row: {
          adicionado_por: string | null
          criado_em: string
          id: string
          nivel_geral: number
          nome: string
          pelada_id: string
          posicao: string
          whatsapp: string | null
        }
        Insert: {
          adicionado_por?: string | null
          criado_em?: string
          id?: string
          nivel_geral?: number
          nome: string
          pelada_id: string
          posicao?: string
          whatsapp?: string | null
        }
        Update: {
          adicionado_por?: string | null
          criado_em?: string
          id?: string
          nivel_geral?: number
          nome?: string
          pelada_id?: string
          posicao?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pelada_convidados_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      peladas: {
        Row: {
          aluguel_iniciado_em: string | null
          atraso_registrado_em: string | null
          avaliacao_aberta: boolean
          avaliacao_fecha_em: string | null
          criado_em: string
          criado_por: string
          data: string
          duracao_partida_minutos: number
          goleiros_por_time: number
          gols_para_encerrar: number | null
          grupo_id: string
          horario_fim: string
          horario_inicio: string
          id: string
          jogadores_linha_por_time: number | null
          jogadores_por_time: number
          modalidade_goleiro: string | null
          mvp_user_id: string | null
          nome_pelada: string
          numero_times: number
          quadra_cliente_id: string | null
          quadra_id: string | null
          sistema_disputa: Database["public"]["Enums"]["sistema_disputa"]
          sorteio_feito: boolean
          status: Database["public"]["Enums"]["status_pelada"]
          tempo_locado_minutos: number | null
        }
        Insert: {
          aluguel_iniciado_em?: string | null
          atraso_registrado_em?: string | null
          avaliacao_aberta?: boolean
          avaliacao_fecha_em?: string | null
          criado_em?: string
          criado_por: string
          data: string
          duracao_partida_minutos?: number
          goleiros_por_time?: number
          gols_para_encerrar?: number | null
          grupo_id: string
          horario_fim: string
          horario_inicio: string
          id?: string
          jogadores_linha_por_time?: number | null
          jogadores_por_time?: number
          modalidade_goleiro?: string | null
          mvp_user_id?: string | null
          nome_pelada: string
          numero_times?: number
          quadra_cliente_id?: string | null
          quadra_id?: string | null
          sistema_disputa?: Database["public"]["Enums"]["sistema_disputa"]
          sorteio_feito?: boolean
          status?: Database["public"]["Enums"]["status_pelada"]
          tempo_locado_minutos?: number | null
        }
        Update: {
          aluguel_iniciado_em?: string | null
          atraso_registrado_em?: string | null
          avaliacao_aberta?: boolean
          avaliacao_fecha_em?: string | null
          criado_em?: string
          criado_por?: string
          data?: string
          duracao_partida_minutos?: number
          goleiros_por_time?: number
          gols_para_encerrar?: number | null
          grupo_id?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          jogadores_linha_por_time?: number | null
          jogadores_por_time?: number
          modalidade_goleiro?: string | null
          mvp_user_id?: string | null
          nome_pelada?: string
          numero_times?: number
          quadra_cliente_id?: string | null
          quadra_id?: string | null
          sistema_disputa?: Database["public"]["Enums"]["sistema_disputa"]
          sorteio_feito?: boolean
          status?: Database["public"]["Enums"]["status_pelada"]
          tempo_locado_minutos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "peladas_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peladas_quadra_id_fkey"
            columns: ["quadra_id"]
            isOneToOne: false
            referencedRelation: "quadras_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      placar_sessao: {
        Row: {
          ativa: boolean
          encerrada_em: string | null
          id: string
          iniciada_em: string
          pelada_id: string
        }
        Insert: {
          ativa?: boolean
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string
          pelada_id: string
        }
        Update: {
          ativa?: boolean
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string
          pelada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placar_sessao_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_config: {
        Row: {
          acao: string
          ativo: boolean
          descricao: string
          id: string
          multiplicador_capitao: number
          valor_pontos: number
        }
        Insert: {
          acao: string
          ativo?: boolean
          descricao: string
          id?: string
          multiplicador_capitao?: number
          valor_pontos: number
        }
        Update: {
          acao?: string
          ativo?: boolean
          descricao?: string
          id?: string
          multiplicador_capitao?: number
          valor_pontos?: number
        }
        Relationships: []
      }
      pontos_historico: {
        Row: {
          acao: string
          criado_em: string
          descricao_legivel: string | null
          id: string
          pelada_id: string | null
          saldo_apos: number
          user_id: string
          valor_pontos: number
        }
        Insert: {
          acao: string
          criado_em?: string
          descricao_legivel?: string | null
          id?: string
          pelada_id?: string | null
          saldo_apos: number
          user_id: string
          valor_pontos: number
        }
        Update: {
          acao?: string
          criado_em?: string
          descricao_legivel?: string | null
          id?: string
          pelada_id?: string | null
          saldo_apos?: number
          user_id?: string
          valor_pontos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pontos_historico_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          altura: number | null
          bio: string | null
          cidade: string | null
          criado_em: string
          data_nascimento: string | null
          email: string
          estado: string | null
          foto_url: string | null
          id: string
          motivo_rebaixamento: string | null
          motivo_suspensao: string | null
          nome: string
          peso: number | null
          plano: string
          plano_validade: string | null
          pontos_total: number
          posicao_preferida: string | null
          quer_ser_goleiro: boolean
          rebaixado_em: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          altura?: number | null
          bio?: string | null
          cidade?: string | null
          criado_em?: string
          data_nascimento?: string | null
          email?: string
          estado?: string | null
          foto_url?: string | null
          id?: string
          motivo_rebaixamento?: string | null
          motivo_suspensao?: string | null
          nome?: string
          peso?: number | null
          plano?: string
          plano_validade?: string | null
          pontos_total?: number
          posicao_preferida?: string | null
          quer_ser_goleiro?: boolean
          rebaixado_em?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          altura?: number | null
          bio?: string | null
          cidade?: string | null
          criado_em?: string
          data_nascimento?: string | null
          email?: string
          estado?: string | null
          foto_url?: string | null
          id?: string
          motivo_rebaixamento?: string | null
          motivo_suspensao?: string | null
          nome?: string
          peso?: number | null
          plano?: string
          plano_validade?: string | null
          pontos_total?: number
          posicao_preferida?: string | null
          quer_ser_goleiro?: boolean
          rebaixado_em?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      quadras: {
        Row: {
          arena_id: string
          ativo: boolean
          criado_em: string
          duracao_partida_padrao: number
          goleiros_por_time: number
          id: string
          jogadores_por_time: number
          nome: string
          slug: string
          tipo_superficie: string
          valor_padrao: number | null
        }
        Insert: {
          arena_id: string
          ativo?: boolean
          criado_em?: string
          duracao_partida_padrao?: number
          goleiros_por_time?: number
          id?: string
          jogadores_por_time?: number
          nome: string
          slug: string
          tipo_superficie?: string
          valor_padrao?: number | null
        }
        Update: {
          arena_id?: string
          ativo?: boolean
          criado_em?: string
          duracao_partida_padrao?: number
          goleiros_por_time?: number
          id?: string
          jogadores_por_time?: number
          nome?: string
          slug?: string
          tipo_superficie?: string
          valor_padrao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quadras_arena_id_fkey"
            columns: ["arena_id"]
            isOneToOne: false
            referencedRelation: "arenas"
            referencedColumns: ["id"]
          },
        ]
      }
      quadras_publicas: {
        Row: {
          capacidade_total: number | null
          cidade: string | null
          criada_por: string | null
          criado_em: string
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          publica: boolean
          slug_arena: string | null
          slug_quadra: string | null
          tipo_superficie: Database["public"]["Enums"]["tipo_superficie"]
        }
        Insert: {
          capacidade_total?: number | null
          cidade?: string | null
          criada_por?: string | null
          criado_em?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          publica?: boolean
          slug_arena?: string | null
          slug_quadra?: string | null
          tipo_superficie?: Database["public"]["Enums"]["tipo_superficie"]
        }
        Update: {
          capacidade_total?: number | null
          cidade?: string | null
          criada_por?: string | null
          criado_em?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          publica?: boolean
          slug_arena?: string | null
          slug_quadra?: string | null
          tipo_superficie?: Database["public"]["Enums"]["tipo_superficie"]
        }
        Relationships: []
      }
      rankings_snapshot: {
        Row: {
          criado_em: string
          defesas_periodo: number
          gols_periodo: number
          id: string
          passes_periodo: number
          pontos_periodo: number
          posicao: number
          referencia_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          defesas_periodo?: number
          gols_periodo?: number
          id?: string
          passes_periodo?: number
          pontos_periodo?: number
          posicao: number
          referencia_id: string
          tipo: string
          user_id: string
        }
        Update: {
          criado_em?: string
          defesas_periodo?: number
          gols_periodo?: number
          id?: string
          passes_periodo?: number
          pontos_periodo?: number
          posicao?: number
          referencia_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      selos: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          condicao_campo: string
          condicao_tipo: string
          condicao_valor: number
          descricao: string | null
          icone_emoji: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo: string
          condicao_campo: string
          condicao_tipo?: string
          condicao_valor: number
          descricao?: string | null
          icone_emoji: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          condicao_campo?: string
          condicao_tipo?: string
          condicao_valor?: number
          descricao?: string | null
          icone_emoji?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          atualizado_em: string
          chute: number
          drible: number
          id: string
          origem_ultima_atualizacao: string | null
          passe: number
          peso_capitao_atual: number
          posicionamento: number
          resistencia: number
          total_avaliacoes_recebidas: number
          user_id: string
          velocidade: number
        }
        Insert: {
          atualizado_em?: string
          chute?: number
          drible?: number
          id?: string
          origem_ultima_atualizacao?: string | null
          passe?: number
          peso_capitao_atual?: number
          posicionamento?: number
          resistencia?: number
          total_avaliacoes_recebidas?: number
          user_id: string
          velocidade?: number
        }
        Update: {
          atualizado_em?: string
          chute?: number
          drible?: number
          id?: string
          origem_ultima_atualizacao?: string | null
          passe?: number
          peso_capitao_atual?: number
          posicionamento?: number
          resistencia?: number
          total_avaliacoes_recebidas?: number
          user_id?: string
          velocidade?: number
        }
        Relationships: []
      }
      sorteio_log: {
        Row: {
          criado_em: string
          id: string
          pelada_id: string
          realizado_por: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          pelada_id: string
          realizado_por: string
          tipo: string
        }
        Update: {
          criado_em?: string
          id?: string
          pelada_id?: string
          realizado_por?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sorteio_log_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_assinaturas: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          plano: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          plano: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          plano?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      temporadas: {
        Row: {
          criado_em: string
          data_fim: string
          data_inicio: string
          id: string
          numero: number
          status: string
        }
        Insert: {
          criado_em?: string
          data_fim: string
          data_inicio: string
          id?: string
          numero: number
          status?: string
        }
        Update: {
          criado_em?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          numero?: number
          status?: string
        }
        Relationships: []
      }
      temporadas_snapshot: {
        Row: {
          chute_media: number | null
          criado_em: string
          drible_media: number | null
          grupo_id: string
          id: string
          nivel_geral_fim: number | null
          nivel_geral_inicio: number | null
          passe_media: number | null
          posicionamento_media: number | null
          resistencia_media: number | null
          temporada_id: string
          total_avaliacoes_recebidas: number | null
          total_peladas_jogadas: number | null
          user_id: string
          variacao: number | null
          velocidade_media: number | null
        }
        Insert: {
          chute_media?: number | null
          criado_em?: string
          drible_media?: number | null
          grupo_id: string
          id?: string
          nivel_geral_fim?: number | null
          nivel_geral_inicio?: number | null
          passe_media?: number | null
          posicionamento_media?: number | null
          resistencia_media?: number | null
          temporada_id: string
          total_avaliacoes_recebidas?: number | null
          total_peladas_jogadas?: number | null
          user_id: string
          variacao?: number | null
          velocidade_media?: number | null
        }
        Update: {
          chute_media?: number | null
          criado_em?: string
          drible_media?: number | null
          grupo_id?: string
          id?: string
          nivel_geral_fim?: number | null
          nivel_geral_inicio?: number | null
          passe_media?: number | null
          posicionamento_media?: number | null
          resistencia_media?: number | null
          temporada_id?: string
          total_avaliacoes_recebidas?: number | null
          total_peladas_jogadas?: number | null
          user_id?: string
          variacao?: number | null
          velocidade_media?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "temporadas_snapshot_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporadas_snapshot_temporada_id_fkey"
            columns: ["temporada_id"]
            isOneToOne: false
            referencedRelation: "temporadas"
            referencedColumns: ["id"]
          },
        ]
      }
      time_jogadores: {
        Row: {
          criado_em: string
          eh_goleiro: boolean
          id: string
          pelada_id: string
          time_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          eh_goleiro?: boolean
          id?: string
          pelada_id: string
          time_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          eh_goleiro?: boolean
          id?: string
          pelada_id?: string
          time_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_jogadores_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_jogadores_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      times: {
        Row: {
          cor: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          pelada_id: string
        }
        Insert: {
          cor: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          pelada_id: string
        }
        Update: {
          cor?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          pelada_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "times_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_selos: {
        Row: {
          conquistado_em: string
          exibir_no_perfil: boolean
          id: string
          selo_id: string
          user_id: string
        }
        Insert: {
          conquistado_em?: string
          exibir_no_perfil?: boolean
          id?: string
          selo_id: string
          user_id: string
        }
        Update: {
          conquistado_em?: string
          exibir_no_perfil?: boolean
          id?: string
          selo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_selos_selo_id_fkey"
            columns: ["selo_id"]
            isOneToOne: false
            referencedRelation: "selos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      confirmacoes_completas: {
        Row: {
          chute: number | null
          confirmacao_id: string | null
          confirmado_em: string | null
          drible: number | null
          email: string | null
          foto_url: string | null
          nivel_geral: number | null
          nome: string | null
          passe: number | null
          pelada_id: string | null
          posicionamento: number | null
          resistencia: number | null
          status: Database["public"]["Enums"]["status_confirmacao"] | null
          user_id: string | null
          velocidade: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pelada_confirmacoes_pelada_id_fkey"
            columns: ["pelada_id"]
            isOneToOne: false
            referencedRelation: "peladas"
            referencedColumns: ["id"]
          },
        ]
      }
      membros_completos: {
        Row: {
          chute: number | null
          cidade: string | null
          drible: number | null
          email: string | null
          entrou_em: string | null
          estado: string | null
          foto_url: string | null
          grupo_id: string | null
          membro_id: string | null
          nivel_geral: number | null
          nome: string | null
          papel: Database["public"]["Enums"]["papel_membro"] | null
          passe: number | null
          peso_capitao: number | null
          posicionamento: number | null
          resistencia: number | null
          status: Database["public"]["Enums"]["status_membro"] | null
          total_avaliacoes: number | null
          user_id: string | null
          velocidade: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_convite_grupo: { Args: { _convite_id: string }; Returns: string }
      atualizar_desafios: {
        Args: { _acao: string; _user_id: string }
        Returns: undefined
      }
      atualizar_ofensiva: {
        Args: { _data: string; _user_id: string }
        Returns: undefined
      }
      check_selos: { Args: { _user_id: string }; Returns: undefined }
      creditar_pontos: {
        Args: { _acao: string; _pelada_id?: string; _user_id: string }
        Returns: undefined
      }
      criar_codigo_indicacao: {
        Args: { _grupo_id: string; _tipo: string; _user_id: string }
        Returns: string
      }
      criar_feed_post: {
        Args: {
          _conteudo: Json
          _grupo: string
          _pelada: string
          _tipo: string
          _user: string
        }
        Returns: string
      }
      fechar_temporada: { Args: { _temporada_id: string }; Returns: undefined }
      gerar_posts_pelada: { Args: { _pelada_id: string }; Returns: undefined }
      grupo_de_pelada: { Args: { _pelada_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_grupo_capitao: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: boolean
      }
      is_grupo_member: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: boolean
      }
      media_skill_user: { Args: { _user_id: string }; Returns: number }
      recalcular_skills_jogador: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: undefined
      }
      recusar_convite_grupo: {
        Args: { _convite_id: string }
        Returns: undefined
      }
      slugify: { Args: { _text: string }; Returns: string }
      user_stats: { Args: { _user_id: string }; Returns: Json }
      verify_capitao_status: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "jogador" | "capitao" | "dono_quadra" | "parceiro" | "admin"
      papel_membro: "jogador" | "auxiliar" | "capitao"
      sistema_disputa: "rodizio" | "mata_mata" | "pontos_corridos"
      status_confirmacao:
        | "confirmado"
        | "recusado"
        | "lista_espera"
        | "cancelado_tarde"
      status_membro: "ativo" | "removido"
      status_partida: "aguardando" | "em_andamento" | "encerrada"
      status_pelada:
        | "aguardando"
        | "confirmada"
        | "em_andamento"
        | "encerrada"
        | "cancelada"
      tipo_lance: "gol" | "passe_decisivo" | "defesa" | "falta" | "outro"
      tipo_superficie: "society" | "futsal" | "campo" | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["jogador", "capitao", "dono_quadra", "parceiro", "admin"],
      papel_membro: ["jogador", "auxiliar", "capitao"],
      sistema_disputa: ["rodizio", "mata_mata", "pontos_corridos"],
      status_confirmacao: [
        "confirmado",
        "recusado",
        "lista_espera",
        "cancelado_tarde",
      ],
      status_membro: ["ativo", "removido"],
      status_partida: ["aguardando", "em_andamento", "encerrada"],
      status_pelada: [
        "aguardando",
        "confirmada",
        "em_andamento",
        "encerrada",
        "cancelada",
      ],
      tipo_lance: ["gol", "passe_decisivo", "defesa", "falta", "outro"],
      tipo_superficie: ["society", "futsal", "campo", "outro"],
    },
  },
} as const
