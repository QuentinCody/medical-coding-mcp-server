import { DurableObject } from "cloudflare:workers";
interface MonitorEnv {
    MONITOR_DO: DurableObjectNamespace;
    /** Cross-script binding to fda-orange-book-mcp-server's MyMCP DO (in-fabric, no public hop). */
    SRV_FDA_ORANGE_BOOK: DurableObjectNamespace;
}
/** One Durable Object per subscription (idFromName `sub:<id>`): owns its snapshot chain + alarm. */
export declare class MonitorDO extends DurableObject<MonitorEnv> {
    private readonly sql;
    private callId;
    constructor(ctx: DurableObjectState, env: MonitorEnv);
    private migrate;
    private nextId;
    private stubFor;
    private loadSub;
    private firstActiveSub;
    private latestSnapshot;
    /** One monitor tick: re-run the saved query, diff vs the last snapshot, append + record changes. */
    private check;
    private create;
    private changes;
    alarm(alarmInfo?: AlarmInvocationInfo): Promise<void>;
    fetch(req: Request): Promise<Response>;
}
export {};
//# sourceMappingURL=monitor-do.d.ts.map