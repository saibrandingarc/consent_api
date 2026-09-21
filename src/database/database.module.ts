import { Global, Module } from '@nestjs/common';
import { createRepositories, prisma } from '@cmp/database';

export const REPOS = Symbol('REPOS');
export const PRISMA = Symbol('PRISMA');

@Global()
@Module({
  providers: [
    { provide: PRISMA, useValue: prisma },
    { provide: REPOS, useFactory: () => createRepositories(prisma) },
  ],
  exports: [REPOS, PRISMA],
})
export class DatabaseModule {}
