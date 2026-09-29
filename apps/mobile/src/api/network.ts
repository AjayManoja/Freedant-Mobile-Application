import { create } from 'zustand';

/** NFR-UX-07: set by the API client from real request outcomes, shown as the offline banner. */
export const useNetwork = create<{ offline: boolean }>(() => ({ offline: false }));
export const markOnline = (online: boolean) => {
  if (useNetwork.getState().offline === online) useNetwork.setState({ offline: !online });
};
