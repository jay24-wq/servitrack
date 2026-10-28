import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { dicebearAvatar } from '../../lib/avatar';
import { cn } from '../../lib/utils';

interface UserAvatarProps extends Omit<React.ComponentProps<typeof Avatar>, 'children'> {
  seed: string;
  initials: string;
  alt?: string;
  backgroundColor?: string;
}

function UserAvatar({ seed, initials, alt, backgroundColor, className, ...props }: UserAvatarProps) {
  return (
    <Avatar className={cn('overflow-hidden', className)} {...props}>
      <AvatarImage src={dicebearAvatar(seed, { backgroundColor })} alt={alt ?? seed} loading="lazy" />
      <AvatarFallback className="uppercase">{initials}</AvatarFallback>
    </Avatar>
  );
}

export { UserAvatar };
