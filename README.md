# Kevi

![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6)

> A distributed key-value store, built from scratch to actually understand distributed systems — not just read about them.

---

## Table of Contents

- [What This Is](#what-this-is)
- [Why](#why)
- [Architecture at a Glance](#architecture-at-a-glance)
- [The Method: Learn → Implement → Break → Fix](#the-method-learn--implement--break--fix)
- [Roadmap](#roadmap)


---

## What This Is

Kevi is a distributed key-value store implemented from first principles: a hand-rolled LSM-tree storage engine, a self-implemented Raft consensus protocol, gRPC/Protobuf for wire transport, and consistent-hash-based partitioning across multiple Raft groups — the same shape of system as etcd, TiKV, or CockroachDB's storage layer, minus a couple of decades of production hardening.

## Why

Most people learn distributed systems by reading papers or using systems someone else built. This project inverts that: build the naive version first, let it fail in the way real systems fail (data loss on crash, split-brain leadership, stale reads after a failover, double-voting after a restart), and only then implement the fix that the literature prescribes. 

The target is a system that's genuinely production-plausible by the end, not a toy that's discarded once the learning is "done" — see [The Production Decision](#the-production-decision).

## Architecture at a Glance

| Layer | Choice |
|---|---|
| Language / Framework | TypeScript, NestJS |
| Storage engine | Hand-rolled LSM-tree (WAL → memtable → SSTables → compaction → bloom filters) |
| Consensus | Self-implemented Raft (leader election, log replication, joint-consensus membership changes) |
| Transport | gRPC + Protobuf |
| Partitioning | Consistent hashing with virtual nodes; multi-Raft (one group per shard) |
| Deployment | Docker Compose (local multi-node) → Kubernetes StatefulSets (production) |
| Observability | Prometheus, Grafana, Loki, Tempo |
| Production consensus substrate (optional) | etcd, as a swap-in alternative to the hand-rolled Raft — see Phase 8 |

## The Method: Learn → Implement → Break → Fix

Every week in the roadmap follows the same structure:

1. **Learn** — the concept and why it exists
2. **Implement** — the smallest version that demonstrates it
3. **Problem observed** — the specific, reproducible failure the current implementation has
4. **Tools** — what gets pulled in to fix or measure it


## Roadmap

<details>
<summary><strong>Phase 1 — Foundations: Naive Single Node (Weeks 1–3)</strong></summary>

- **Week 1 — Naive in-memory KV store**: NestJS service, in-memory `Map`, REST/TCP `GET`/`PUT`/`DELETE`. *Problem: process restart = total data loss.*
- **Week 2 — Write-Ahead Log**: append-only log, replay on startup. *Problem: WAL grows unbounded; replay time grows linearly.*
- **Week 3 — Snapshotting & log segments**: atomic snapshots, WAL rolled into fixed-size segment files, whole-segment deletion once covered. *Problem: naive full-snapshot blocks the process on large datasets.*

</details>

<details>
<summary><strong>Phase 2 — Storage Engine: LSM-Tree (Weeks 4–6)</strong></summary>

- **Week 4 — Memtable**: sorted in-memory structure (skip list), flush-to-disk on size threshold. *Problem: unbounded memtable growth; writes stall during flush.*
- **Week 5 — SSTables & compaction**: SSTable writer/reader, background compaction. *Problem: read/write amplification.*
- **Week 6 — Bloom filters & sparse indexes**: per-SSTable bloom filter, index blocks for binary search. *Problem solved: eliminates most unnecessary disk reads for missing keys.*

*Optional shortcut: bind to RocksDB via the `rocksdb` npm package instead of hand-rolling the engine, trading storage-engine depth for more time in Raft. Kevi takes the hand-rolled path.*

</details>

<details>
<summary><strong>Phase 3 — Replication, Naively First (Weeks 7–8)</strong></summary>

- **Week 7 — Leader-follower replication**: single leader pushes writes to followers over gRPC, sync vs. async. *Problem: leader crash = no automatic failover; dual-leader = split brain.*
- **Week 8 — Study week**: CAP theorem, FLP impossibility, the Raft paper. No implementation — the conceptual bridge into Phase 4.

</details>

<details>
<summary><strong>Phase 4 — Consensus: Raft (Weeks 9–13)</strong></summary>

The core of the project.

- **Week 9 — Leader election**: `RequestVote` RPC, randomized election timeouts, term numbers. *Problem: split votes, spurious elections under jitter.*
- **Week 10 — Log replication**: `AppendEntries` RPC, log-matching property, conflict resolution. *Problem: follower logs diverge after crash/reconnect — watch it self-heal.*
- **Week 11 — Commit safety**: commit index tracking (Raft's commit index = Kafka's high watermark), election-restriction rule. *Problem: without the restriction, a stale node can become leader and overwrite committed entries — reproduced deliberately, then fixed.*
- **Week 12 — Persistence & crash recovery**: persist `currentTerm`, `votedFor`, and the log before responding to RPCs. *Problem: skipping `votedFor` persistence allows double-voting after restart — triggered on purpose.*
- **Week 13 — Chaos-test Raft**: kill the leader mid-write, partition a minority, verify no two leaders ever commit conflicting entries. *Tools: Toxiproxy.*

</details>

<details>
<summary><strong>Phase 5 — Partitioning & Scale (Weeks 14–17)</strong></summary>

- **Week 14 — Consistent hashing**: hash ring with virtual nodes, key→shard routing. *Problem: without virtual nodes, shard changes move a disproportionate share of keys.*
- **Week 15 — Multi-Raft**: one Raft group per shard, co-located across the same node set. *Problem: per-group heartbeats multiply into heartbeat storms — the TiKV pattern.*
- **Week 16 — Cluster membership changes**: joint consensus (Raft paper §6). *Problem: naive direct member-set swap allows two disjoint majorities to each elect a leader — reproduced before the safe version.*
- **Week 17 — Snapshot transfer**: `InstallSnapshot` RPC for new/lagging nodes. *Problem: a new node can't replay entire log history — needs snapshot + log tail only.*

</details>

<details>
<summary><strong>Phase 6 — Consistency & Client Semantics (Weeks 18–19)</strong></summary>

- **Week 18 — Linearizable reads**: ReadIndex protocol, lease-reads as an optimization. *Problem: naive follower (or even leader-without-ReadIndex) reads can return stale data after a leadership change.*
- **Week 19 — Failure detection**: heartbeat-based detection, phi-accrual detectors, SWIM gossip (optional eventually-consistent extension). *Problem: distinguishing dead vs. slow vs. partitioned is fundamentally ambiguous, not a bug to fix.*

</details>

<details>
<summary><strong>Optional Track — gRPC-Native Client API (Weeks O1–O4)</strong></summary>

Replaces the REST client API with gRPC end-to-end. Optional — the core roadmap is complete without it — but surfaces problems REST never forces: schema evolution, leader-aware routing, long-lived streaming state.

- **O1 — Migrate client API to gRPC**: protobuf service definitions, field-numbering discipline for compatibility.
- **O2 — Leader-aware client routing**: client-side load balancing, `NotLeader` redirect pattern (the etcd/Raft-standard approach).
- **O3 — Streaming Watch API**: server-streaming `Watch` RPC (etcd's Watch API), bounded queue + drop-or-disconnect policy for slow consumers.
- **O4 — Auth & mTLS via interceptors**: gRPC interceptors, mutual TLS. *Tools: `ghz` for gRPC-specific load testing.*

</details>

<details>
<summary><strong>Phase 7 — Production Hardening (Weeks 20–23)</strong></summary>

- **Week 20 — Security**: mTLS between nodes, API-key/JWT auth on the client-facing API.
- **Week 21 — Observability**: leader-election frequency, replication lag, per-shard latency, compaction throughput. *Tools: Prometheus, Grafana, OpenTelemetry, Tempo, Loki.*
- **Week 22 — Load testing**: throughput/latency across read-heavy, write-heavy, mixed workloads; tail latency during induced leader elections. *Tools: k6 or a custom YCSB-style harness.*
- **Week 23 — Deployment**: Docker Compose locally, Kubernetes StatefulSets in production (stable network identity + persistent volumes). *Tools: Helm.*

</details>




