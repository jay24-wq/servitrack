import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { dicebearAvatar } from '../../lib/avatar';
import { cn } from '../../lib/utils';

interface UserAvatarProps extends Omit<React.ComponentProps<typeof Avatar>, 'children'> {
  seed: string;
  initials: string;
  alt?: string;
  backgroundColor?: string;
  imageSrc?: string | null;
}

function UserAvatar({ seed, initials, alt, backgroundColor, imageSrc, className, ...props }: UserAvatarProps) {
  const src = imageSrc || dicebearAvatar(seed, { backgroundColor });

  return (
    <Avatar className={cn('overflow-hidden', className)} {...props}>
      <AvatarImage src={src} alt={alt ?? seed} loading="lazy" />
      {!imageSrc && <AvatarFallback className="uppercase">{initials}</AvatarFallback>}
    </Avatar>
  );
}

export { UserAvatar };
