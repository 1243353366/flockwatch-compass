# Render Architecture Sources

The production and staged-worker decisions use the following official Render documentation, accessed on 21 September 2026.

| Source | Relevant facts used |
| --- | --- |
| [Background Workers](https://render.com/docs/background-workers) | Background workers have no incoming network traffic, poll a queue such as Render Key Value, and are appropriate for third-party API and AI-model work. Node workers commonly use BullMQ. |
| [Intro to Render Workflows](https://render.com/docs/workflows) | Workflows provide managed task queuing, retries, and on-demand task instances. Render bills task compute and temporary state retention. Workflow runs expose no incoming ports. |
| [Limits and Pricing for Render Workflows](https://render.com/docs/workflows-limits) | Workflow compute and retained task state are billable, so no Workflow was activated without payment authorization. |
| [Blueprint YAML Reference](https://render.com/docs/blueprint-spec) | Render supports `worker`, `workflow`, and `keyvalue` service types. Web services have a free plan; private services and background workers begin with paid compute plans. Key Value supports a free 25 MB plan and private-only access via an empty IP allow list. |
| [Render Key Value](https://render.com/docs/key-value) | Key Value is suitable for shared caches and job queues and can be used with background-worker frameworks. |
| [Render Pricing](https://render.com/pricing) | Free web compute is available with limitations; paid compute is required for the staged background-worker service. |

A free private Key Value instance was provisioned. The paid worker definition is staged in `render-worker.yaml` but is not active. The live web service uses bounded in-process execution while optional AI remains disabled.
