export type ArtifactEffect =
  | { type: 'money'; amount: number }
  | { type: 'supplies'; amount: number }
  | { type: 'specimens'; amount: number }
  | { type: 'morale'; amount: number };

export type ArtifactDefinition = {
  id: string;
  name: string;
  description: string;
  effects: ArtifactEffect[];
};

export type ArtifactDefinitions = Record<string, ArtifactDefinition>;
