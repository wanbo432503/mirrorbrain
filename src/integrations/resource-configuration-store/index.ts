import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  DEFAULT_STORED_RESOURCE_CONFIGURATION,
  type StoredResourceConfiguration,
} from '../../modules/resource-configuration/index.js';

export interface ResourceConfigurationStore {
  readResourceConfiguration(): Promise<StoredResourceConfiguration>;
  writeResourceConfiguration(config: StoredResourceConfiguration): Promise<void>;
}

interface CreateFileResourceConfigurationStoreInput {
  workspaceDir: string;
}

function getResourceConfigurationPath(workspaceDir: string): string {
  return join(workspaceDir, 'mirrorbrain', 'state', 'resource-configuration.json');
}

export function createFileResourceConfigurationStore(
  input: CreateFileResourceConfigurationStoreInput,
): ResourceConfigurationStore {
  const configurationPath = getResourceConfigurationPath(input.workspaceDir);

  return {
    async readResourceConfiguration() {
      try {
        const storedConfig = JSON.parse(
          await readFile(configurationPath, 'utf8'),
        ) as Partial<StoredResourceConfiguration>;

        return {
          llm: {
            ...DEFAULT_STORED_RESOURCE_CONFIGURATION.llm,
            ...storedConfig.llm,
          },
          embedding: {
            ...DEFAULT_STORED_RESOURCE_CONFIGURATION.embedding,
            ...storedConfig.embedding,
          },
          search: {
            ...DEFAULT_STORED_RESOURCE_CONFIGURATION.search,
            ...storedConfig.search,
          },
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return DEFAULT_STORED_RESOURCE_CONFIGURATION;
        }

        throw error;
      }
    },
    async writeResourceConfiguration(config) {
      await mkdir(dirname(configurationPath), { recursive: true });
      await writeFile(configurationPath, JSON.stringify(config, null, 2));
    },
  };
}
