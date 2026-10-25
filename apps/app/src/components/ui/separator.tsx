import * as React from 'react';
import { cn } from '@/lib/utils';
import { Separator as SeparatorPrimitive } from 'radix-ui';

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        // Sem linha: o separador é só espaço.
        'shrink-0 bg-transparent data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
