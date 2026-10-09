"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import type { CurriculumRewardDefinitionApi, LearningStepApi } from "@/lib/api";
import { getInventoryProducts, type InventoryProduct } from "@/lib/inventoryApi";
import { BELT_RANKS } from "@/lib/beltRanks";

type Props = {
  step: LearningStepApi;
  onChange: (update: (current: LearningStepApi) => LearningStepApi) => void;
};

type RewardType = Exclude<CurriculumRewardDefinitionApi["type"], "BELT_PROGRESSION">;
const rewardTypes: Array<{ value: RewardType; label: string }> = [
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "MERCHANDISE", label: "Inventory item" },
  { value: "POINTS", label: "Points" },
  { value: "RECOGNITION", label: "Recognition" },
  { value: "CUSTOM", label: "Custom reward" },
];

function rewardName(type: RewardType) {
  if (type === "CERTIFICATE") return "Achievement certificate";
  if (type === "POINTS") return "Points";
  if (type === "RECOGNITION") return "Recognition";
  return "";
}

function newReward(type: RewardType): CurriculumRewardDefinitionApi {
  return { rewardId: `pending-${Date.now()}-${Math.random()}`, type, name: rewardName(type), quantity: 1, active: true };
}

export default function CurriculumMilestoneFields({ step, onChange }: Props) {
  const rewards = step.rewards || [];
  const beltReward = rewards.find((reward) => reward.type === "BELT_PROGRESSION");
  const otherRewards = rewards.filter((reward) => reward.type !== "BELT_PROGRESSION");
  const needsInventory = otherRewards.some((reward) => reward.type === "MERCHANDISE");
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  useEffect(() => {
    if (!needsInventory) return;
    void getInventoryProducts().then((response) => setProducts(response.products || [])).catch(() => setProducts([]));
  }, [needsInventory]);

  const setBelt = (targetBelt: string) => onChange((current) => {
    const currentRewards = current.rewards || [];
    const existing = currentRewards.find((reward) => reward.type === "BELT_PROGRESSION");
    const rest = currentRewards.filter((reward) => reward.type !== "BELT_PROGRESSION");
    if (!targetBelt) return { ...current, rewards: rest };
    return { ...current, rewards: [...rest, { ...(existing || { rewardId: `pending-${Date.now()}-${Math.random()}`, type: "BELT_PROGRESSION" as const, quantity: 1, active: true, requiresFormalGrading: true }), name: targetBelt, targetBelt }] };
  });

  const updateReward = (rewardId: string, update: Partial<CurriculumRewardDefinitionApi>) => onChange((current) => ({ ...current, rewards: (current.rewards || []).map((reward) => reward.rewardId === rewardId ? { ...reward, ...update } : reward) }));
  const removeReward = (rewardId: string) => onChange((current) => ({ ...current, rewards: (current.rewards || []).filter((reward) => reward.rewardId !== rewardId) }));
  const addReward = (type: RewardType) => onChange((current) => ({ ...current, rewards: [...(current.rewards || []), newReward(type)] }));

  return <fieldset className="w-full space-y-2 rounded-lg border border-(--line) p-3">
    <legend className="px-1 text-sm font-semibold">Milestone</legend>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(step.isMilestone)} onChange={(event) => onChange((current) => ({ ...current, isMilestone: event.target.checked }))} />Is this a milestone?</label>
    {step.isMilestone && <div className="grid gap-3 rounded-md bg-(--surface) p-3 md:grid-cols-2">
      <label className="block space-y-1 text-xs font-medium">Belt (optional)
        <Select aria-label="Target belt rank" value={beltReward?.targetBelt || ""} onChange={(event) => setBelt(event.target.value)}>
          <option value="">No belt progression</option>
          {!BELT_RANKS.includes(beltReward?.targetBelt as (typeof BELT_RANKS)[number]) && beltReward?.targetBelt && <option value={beltReward.targetBelt}>{beltReward.targetBelt}</option>}
          {BELT_RANKS.map((belt) => <option key={belt} value={belt}>{belt}</option>)}
        </Select>
        <span className="block font-normal text-(--ink-muted)">Belt changes still require the existing formal grading or authorized promotion workflow.</span>
      </label>

      <label className="block space-y-1 text-xs font-medium">Add reward (optional)
        <Select aria-label="Add reward type" value="" onChange={(event) => { if (event.target.value) addReward(event.target.value as RewardType); }}>
          <option value="">Choose a reward type</option>
          {rewardTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </Select>
      </label>

      <div className="space-y-2 md:col-span-2">
        {!beltReward && !otherRewards.length && <p className="text-xs text-(--ink-muted)">No reward is required. This milestone can be earned on its own.</p>}
        {otherRewards.map((reward) => <article key={reward.rewardId} className="flex flex-wrap items-end gap-2 rounded-md border border-(--line) p-2">
          <span className="mr-auto self-center text-xs font-semibold">{rewardTypes.find((type) => type.value === reward.type)?.label || "Reward"}</span>
          {reward.type === "MERCHANDISE" ? <>
            <label className="min-w-48 flex-1 space-y-1 text-xs">Inventory item
              <Select aria-label="Inventory item" value={typeof reward.product === "string" ? reward.product : ""} onChange={(event) => {
                const product = products.find((item) => item._id === event.target.value);
                updateReward(reward.rewardId, { product: event.target.value || null, name: product?.name || "" });
              }}><option value="">Choose an active item</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name} · {product.sku}</option>)}</Select>
            </label>
            <label className="w-24 space-y-1 text-xs">Quantity<Input aria-label="Inventory quantity" type="number" min={1} max={10000} value={reward.quantity || 1} onChange={(event) => updateReward(reward.rewardId, { quantity: Number(event.target.value) })} /></label>
          </> : reward.type === "POINTS" ? <>
            <label className="min-w-40 flex-1 space-y-1 text-xs">Recognition name<Input aria-label="Points reward name" value={reward.name || "Points"} maxLength={160} onChange={(event) => updateReward(reward.rewardId, { name: event.target.value })} /></label>
            <label className="w-24 space-y-1 text-xs">Points<Input aria-label="Points amount" type="number" min={1} max={10000} value={reward.quantity || 1} onChange={(event) => updateReward(reward.rewardId, { quantity: Number(event.target.value) })} /></label>
          </> : <label className="min-w-40 flex-1 space-y-1 text-xs">Reward name<Input aria-label="Reward name" value={reward.name || ""} maxLength={160} placeholder={reward.type === "CERTIFICATE" ? "Achievement certificate" : "Reward name"} onChange={(event) => updateReward(reward.rewardId, { name: event.target.value })} /></label>}
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={reward.active !== false} onChange={(event) => updateReward(reward.rewardId, { active: event.target.checked })} />Active</label>
          <Button type="button" size="sm" variant="ghost" aria-label="Remove reward" onClick={() => removeReward(reward.rewardId)}><Trash2 size={14} /></Button>
        </article>)}
      </div>
    </div>}
  </fieldset>;
}
