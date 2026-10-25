import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Tags, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Tag } from '@elaps/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isDuplicateNameError } from '@/data/catalog';
import { activeTags, tagsOf, useCreateTag, useTags } from '@/data/tags';
import { cn } from '@/lib/utils';

/** Tags da sessão como chips pequenos (somem se não houver nenhuma). */
export function TagChips({
  tagIds,
  tags,
  className,
}: {
  tagIds: readonly string[] | undefined;
  tags: readonly Tag[] | undefined;
  className?: string;
}) {
  const list = tagsOf(tagIds ?? [], tags ?? []);
  if (list.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-1', className)}>
      {list.map((tag) => (
        <li key={tag.id}>
          <Badge variant="secondary" className="font-normal">
            {tag.name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * Escolha de tags: chips selecionados (com ×), busca e "criar tag" inline.
 * Tags arquivadas não são oferecidas, mas continuam aparecendo se já estão na sessão.
 */
export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const tags = useTags();
  const create = useCreateTag();
  const [query, setQuery] = useState('');

  const all = tags.data ?? [];
  const selected = tagsOf(value, all);
  const q = query.trim();
  const available = activeTags(all).filter(
    (tag) => !value.includes(tag.id) && tag.name.toLowerCase().includes(q.toLowerCase()),
  );
  const existing = activeTags(all).find((tag) => tag.name.toLowerCase() === q.toLowerCase());

  async function createTag() {
    try {
      const tag = await create.mutateAsync(q);
      onChange([...value, tag.id]);
      setQuery('');
    } catch (error) {
      toast.error(t(isDuplicateNameError(error) ? 'tags.errors.duplicate' : 'tags.errors.failed'));
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    // Enter na busca escolhe/cria a tag; não envia o formulário do diálogo.
    e.preventDefault();
    if (!q) return;
    if (existing) {
      if (!value.includes(existing.id)) onChange([...value, existing.id]);
      setQuery('');
    } else {
      void createTag();
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="tag-picker">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('tags.picker.selected')}>
          {selected.map((tag) => (
            <li key={tag.id}>
              <Badge variant="secondary" className="gap-1 pr-1 text-sm font-normal">
                {tag.name}
                {tag.archived_at && (
                  <span className="text-muted-foreground">{t('tags.archivedMark')}</span>
                )}
                <button
                  type="button"
                  aria-label={t('tags.picker.remove', { name: tag.name })}
                  className="rounded-full p-0.5 hover:bg-background/60"
                  onClick={() => onChange(value.filter((id) => id !== tag.id))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        value={query}
        maxLength={40}
        placeholder={t('tags.picker.placeholder')}
        aria-label={t('tags.picker.search')}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {(available.length > 0 || (q && !existing)) && (
        <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          {available.map((tag) => (
            <li key={tag.id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-3 font-normal"
                onClick={() => onChange([...value, tag.id])}
              >
                {tag.name}
              </Button>
            </li>
          ))}
          {q && !existing && (
            <li>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 rounded-full px-3"
                disabled={create.isPending}
                onClick={() => void createTag()}
              >
                <Plus className="size-3" /> {t('tags.picker.create', { name: q })}
              </Button>
            </li>
          )}
        </ul>
      )}
      {!tags.isPending && all.length === 0 && !q && (
        <p className="text-xs text-muted-foreground">{t('tags.picker.empty')}</p>
      )}
    </div>
  );
}

/** Filtro por tags (uma ou mais; vale qualquer uma). Não aparece se não há tags. */
export function TagFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const tags = useTags();
  const all = tags.data ?? [];
  if (all.length === 0) return null;

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 font-normal">
          <Tags className="size-4" />
          {value.length === 0
            ? t('tags.filter.all')
            : t('tags.filter.selected', { count: value.length })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
          {all.map((tag) => (
            <li key={tag.id}>
              <Button
                type="button"
                size="sm"
                variant={value.includes(tag.id) ? 'default' : 'outline'}
                aria-pressed={value.includes(tag.id)}
                className="h-7 rounded-full px-3 font-normal"
                onClick={() => toggle(tag.id)}
              >
                {tag.name}
                {tag.archived_at && <span className="opacity-70">{t('tags.archivedMark')}</span>}
              </Button>
            </li>
          ))}
        </ul>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange([])}>
            {t('tags.filter.clear')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
