"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import FormInput from "@/components/ui/FormInput";
import FormSection from "@/components/ui/FormSection";
import DynamicList from "@/components/ui/DynamicList";
import Modal from "@/components/ui/Modal";
import type { ContainerTemplate } from "@/lib/db/schema";

interface PortEntry {
  containerPort: string;
  hostPort: string;
  protocol: "tcp" | "udp";
}

interface VolumeEntry {
  containerPath: string;
  mode: "rw" | "ro";
}

interface EnvEntry {
  key: string;
  value: string;
}

interface FormState {
  name: string;
  image: string;
  ports: PortEntry[];
  env: EnvEntry[];
  volumes: VolumeEntry[];
  restartPolicy: string;
  hostname: string;
  cmd: string;
  cpuLimit: string;
  memoryLimit: string;
  tty: boolean;
  stdin: boolean;
}

const defaultForm: FormState = {
  name: "",
  image: "",
  ports: [],
  env: [],
  volumes: [],
  restartPolicy: "no",
  hostname: "",
  cmd: "",
  cpuLimit: "",
  memoryLimit: "",
  tty: false,
  stdin: false,
};

export default function CreateContainerPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState<ContainerTemplate[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.image.trim()) errs.image = "Image is required";
    if (form.cpuLimit && (isNaN(Number(form.cpuLimit)) || Number(form.cpuLimit) <= 0)) {
      errs.cpuLimit = "Must be a positive number";
    }
    if (form.memoryLimit && (isNaN(Number(form.memoryLimit)) || Number(form.memoryLimit) <= 0)) {
      errs.memoryLimit = "Must be a positive number (MB)";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    image: form.image.trim(),
    ports: form.ports
      .filter((p) => p.containerPort)
      .map((p) => ({
        containerPort: parseInt(p.containerPort, 10),
        hostPort: p.hostPort ? parseInt(p.hostPort, 10) : undefined,
        protocol: p.protocol,
      })),
    env: form.env
      .filter((e) => e.key)
      .map((e) => `${e.key}=${e.value}`),
    volumes: form.volumes
      .filter((v) => v.containerPath.trim())
      .map((v) => ({ containerPath: v.containerPath.trim(), mode: v.mode })),
    restartPolicy: { name: form.restartPolicy },
    hostname: form.hostname || undefined,
    cmd: form.cmd.trim() ? form.cmd.trim().split(/\s+/) : undefined,
    resources: {
      cpuLimit: form.cpuLimit ? Number(form.cpuLimit) : undefined,
      memoryLimit: form.memoryLimit
        ? Number(form.memoryLimit) * 1024 * 1024
        : undefined,
    },
    tty: form.tty,
    stdin: form.stdin,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/containers/${id}`);
      } else {
        const data = await res.json();
        setErrors({ submit: data.error || "Failed to create container" });
      }
    } catch {
      setErrors({ submit: "Failed to create container" });
    } finally {
      setSubmitting(false);
    }
  };

  const loadTemplates = async () => {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
    setTemplateModalOpen(true);
  };

  const applyTemplate = (template: ContainerTemplate) => {
    try {
      const config = JSON.parse(template.config) as FormState;
      setForm(config);
    } catch {
      // Invalid template config
    }
    setTemplateModalOpen(false);
  };

  const saveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveTemplateName.trim(), config: form }),
    });
    setSaveTemplateOpen(false);
    setSaveTemplateName("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title="Create Container"
        actions={
          <>
            <Button type="button" variant="secondary" onClick={loadTemplates}>
              Load Template
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSaveTemplateOpen(true)}
            >
              Save Template
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create
            </Button>
          </>
        }
      />

      {errors.submit && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {errors.submit}
        </div>
      )}

      <FormSection title="Basic">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Container Name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="my-container"
            error={errors.name}
          />
          <FormInput
            label="Image"
            value={form.image}
            onChange={(e) => updateField("image", e.target.value)}
            placeholder="nginx:latest"
            error={errors.image}
          />
        </div>
      </FormSection>

      <FormSection title="Ports" description="Map container ports to host ports">
        <DynamicList
          items={form.ports}
          onAdd={() =>
            updateField("ports", [
              ...form.ports,
              { containerPort: "", hostPort: "", protocol: "tcp" as const },
            ])
          }
          onRemove={(i) =>
            updateField(
              "ports",
              form.ports.filter((_, idx) => idx !== i)
            )
          }
          addLabel="Add Port"
          renderItem={(port, i) => (
            <div className="grid grid-cols-3 gap-2">
              <input
                className="input-field"
                placeholder="Host Port"
                value={port.hostPort}
                onChange={(e) => {
                  const next = [...form.ports];
                  next[i] = { ...next[i], hostPort: e.target.value };
                  updateField("ports", next);
                }}
              />
              <input
                className="input-field"
                placeholder="Container Port"
                value={port.containerPort}
                onChange={(e) => {
                  const next = [...form.ports];
                  next[i] = { ...next[i], containerPort: e.target.value };
                  updateField("ports", next);
                }}
              />
              <select
                className="input-field"
                value={port.protocol}
                onChange={(e) => {
                  const next = [...form.ports];
                  next[i] = { ...next[i], protocol: e.target.value as "tcp" | "udp" };
                  updateField("ports", next);
                }}
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Environment Variables">
        <DynamicList
          items={form.env}
          onAdd={() =>
            updateField("env", [...form.env, { key: "", value: "" }])
          }
          onRemove={(i) =>
            updateField(
              "env",
              form.env.filter((_, idx) => idx !== i)
            )
          }
          addLabel="Add Variable"
          renderItem={(envVar, i) => (
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input-field"
                placeholder="KEY"
                value={envVar.key}
                onChange={(e) => {
                  const next = [...form.env];
                  next[i] = { ...next[i], key: e.target.value };
                  updateField("env", next);
                }}
              />
              <input
                className="input-field"
                placeholder="value"
                value={envVar.value}
                onChange={(e) => {
                  const next = [...form.env];
                  next[i] = { ...next[i], value: e.target.value };
                  updateField("env", next);
                }}
              />
            </div>
          )}
        />
      </FormSection>

      <FormSection
        title="Volumes"
        description="Specify container paths to mount. Host directories are auto-created under the data directory."
      >
        <DynamicList
          items={form.volumes}
          onAdd={() =>
            updateField("volumes", [
              ...form.volumes,
              { containerPath: "", mode: "rw" as const },
            ])
          }
          onRemove={(i) =>
            updateField(
              "volumes",
              form.volumes.filter((_, idx) => idx !== i)
            )
          }
          addLabel="Add Volume"
          renderItem={(vol, i) => (
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input-field"
                placeholder="/data"
                value={vol.containerPath}
                onChange={(e) => {
                  const next = [...form.volumes];
                  next[i] = { ...next[i], containerPath: e.target.value };
                  updateField("volumes", next);
                }}
              />
              <select
                className="input-field"
                value={vol.mode}
                onChange={(e) => {
                  const next = [...form.volumes];
                  next[i] = { ...next[i], mode: e.target.value as "rw" | "ro" };
                  updateField("volumes", next);
                }}
              >
                <option value="rw">Read/Write</option>
                <option value="ro">Read Only</option>
              </select>
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Restart Policy</label>
            <select
              className="input-field"
              value={form.restartPolicy}
              onChange={(e) => updateField("restartPolicy", e.target.value)}
            >
              <option value="no">No</option>
              <option value="always">Always</option>
              <option value="unless-stopped">Unless Stopped</option>
              <option value="on-failure">On Failure</option>
            </select>
          </div>
          <FormInput
            label="Hostname"
            value={form.hostname}
            onChange={(e) => updateField("hostname", e.target.value)}
            placeholder="Optional"
          />
          <FormInput
            label="Command"
            value={form.cmd}
            onChange={(e) => updateField("cmd", e.target.value)}
            placeholder="e.g., nginx -g 'daemon off;'"
            helpText="Override the default command"
          />
        </div>
      </FormSection>

      <FormSection title="Resource Limits" description="Optional CPU and memory constraints">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="CPU Limit (cores)"
            value={form.cpuLimit}
            onChange={(e) => updateField("cpuLimit", e.target.value)}
            placeholder="e.g., 0.5"
            error={errors.cpuLimit}
          />
          <FormInput
            label="Memory Limit (MB)"
            value={form.memoryLimit}
            onChange={(e) => updateField("memoryLimit", e.target.value)}
            placeholder="e.g., 512"
            error={errors.memoryLimit}
          />
        </div>
      </FormSection>

      <FormSection title="Terminal Options">
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tty}
              onChange={(e) => updateField("tty", e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500"
            />
            <span className="text-sm">Allocate TTY</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.stdin}
              onChange={(e) => updateField("stdin", e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500"
            />
            <span className="text-sm">Attach STDIN</span>
          </label>
        </div>
      </FormSection>

      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Load Template"
      >
        {templates.length === 0 ? (
          <p className="text-gray-400 text-sm">No templates saved yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <span className="text-white font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        title="Save Template"
      >
        <div className="space-y-4">
          <FormInput
            label="Template Name"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            placeholder="My Template"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setSaveTemplateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={saveTemplate}
              disabled={!saveTemplateName.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
