export type RngState = {
  seed: number;
  cursor: number;
};

export type RngStreamsState = {
  campaign: RngState;
  battles: RngState;
  events: RngState;
};
