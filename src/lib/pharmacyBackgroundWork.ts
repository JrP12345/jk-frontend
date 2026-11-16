/** Yield to input/rendering between bounded background chunks. MessageChannel
 * works without depending on idle callbacks or a running network connection.
 */
export function yieldPharmacyBackgroundWork(): Promise<void> {
  if (typeof MessageChannel === "undefined") return Promise.resolve();
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
    channel.port2.postMessage(null);
  });
}
