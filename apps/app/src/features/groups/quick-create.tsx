import { useRef, useState } from 'react';
import type { Group } from '@elaps/core';
import { activeGroups, useCatalog } from '@/data/catalog';
import { NameDialog, type Created } from '@/features/groups/name-dialog';

type Stage = 'group' | 'area' | 'group-first';

/**
 * Criar grupo ou área de qualquer tela (botão flutuante, "Mais", seletor de área).
 * Reusa o NameDialog. "Nova área" pede o grupo; sem nenhum grupo, ou se a pessoa
 * quiser um grupo novo, cria o grupo primeiro e segue direto para a área dele.
 */
export function QuickCreate({
  kind,
  defaultGroupId,
  onClose,
  onCreated,
}: {
  kind: 'group' | 'area';
  defaultGroupId?: string;
  onClose: () => void;
  onCreated?: (created: Created) => void;
}) {
  const catalog = useCatalog();
  const groups = catalog.data ? activeGroups(catalog.data) : [];
  const [stage, setStage] = useState<Stage>(
    kind === 'group' ? 'group' : groups.length === 0 ? 'group-first' : 'area',
  );
  const [fresh, setFresh] = useState<Group | null>(null);
  // O NameDialog chama onClose depois de criar; no passo "grupo primeiro" isso
  // vira "agora a área", não "fechar tudo".
  const justCreated = useRef<Group | null>(null);

  if (!catalog.data) return null;

  if (stage === 'group') {
    return (
      <NameDialog key="group" target={{ kind: 'group' }} onClose={onClose} onCreated={onCreated} />
    );
  }

  if (stage === 'group-first' && !fresh) {
    return (
      <NameDialog
        key="group-first"
        target={{ kind: 'group' }}
        onCreated={(_, group) => {
          justCreated.current = group ?? null;
        }}
        onClose={() => {
          const group = justCreated.current;
          justCreated.current = null;
          if (group) setFresh(group);
          else onClose();
        }}
      />
    );
  }

  return (
    <NameDialog
      key={fresh ? `area-${fresh.id}` : 'area'}
      target={fresh ? { kind: 'area', group: fresh } : { kind: 'area', groups, defaultGroupId }}
      onClose={onClose}
      onCreated={onCreated}
      onNewGroup={fresh ? undefined : () => setStage('group-first')}
    />
  );
}
