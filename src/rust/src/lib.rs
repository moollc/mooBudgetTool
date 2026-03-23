use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Stage {
    pub id: Option<String>,
    pub name: Option<String>,
    pub budget: Option<f64>,
    pub allocated: Option<Vec<f64>>,
    pub completed: Option<Vec<f64>>,
    #[serde(rename = "totalCost")]
    pub total_cost: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StageReconciliation {
    pub id: String,
    pub name: String,
    pub budget: f64,
    pub allocated: f64,
    pub completed: f64,
    pub cost: f64,
    pub variance: f64,
    #[serde(rename = "percentUsed")]
    pub percent_used: f64,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AggregateReconciliation {
    #[serde(rename = "stageCount")]
    pub stage_count: usize,
    #[serde(rename = "totalBudget")]
    pub total_budget: f64,
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
    #[serde(rename = "totalVariance")]
    pub total_variance: f64,
    #[serde(rename = "overallStatus")]
    pub overall_status: String,
}

#[wasm_bindgen]
pub fn reconcile_stage(stage_json: &str) -> String {
    let stage: Stage = match serde_json::from_str(stage_json) {
        Ok(s) => s,
        Err(_) => return String::from("{}"), // return empty on error
    };

    let total_budget = stage.budget.unwrap_or(0.0);
    let total_allocated: f64 = stage.allocated.unwrap_or_default().iter().sum();
    let total_completed: f64 = stage.completed.unwrap_or_default().iter().sum();
    let total_cost = stage.total_cost.unwrap_or(0.0);

    let variance = total_budget - total_cost;
    let percent_used = if total_budget > 0.0 {
        (total_cost / total_budget) * 100.0
    } else {
        0.0
    };

    let status = if variance > 0.0 {
        "under"
    } else if variance.abs() < 10.0 {
        "on"
    } else {
        "over"
    };

    let recon = StageReconciliation {
        id: stage.id.unwrap_or_default(),
        name: stage.name.unwrap_or_default(),
        budget: (total_budget * 10000.0).round() / 10000.0,
        allocated: (total_allocated * 10000.0).round() / 10000.0,
        completed: (total_completed * 10000.0).round() / 10000.0,
        cost: (total_cost * 10000.0).round() / 10000.0,
        variance: (variance * 10000.0).round() / 10000.0,
        percent_used: (percent_used * 10.0).round() / 10.0,
        status: status.to_string(),
    };

    match serde_json::to_string(&recon) {
        Ok(s) => s,
        Err(_) => String::from("{}"),
    }
}

#[wasm_bindgen]
pub fn aggregate_reconciliations(reconciliations_json: &str) -> String {
    let stages: Vec<StageReconciliation> = match serde_json::from_str(reconciliations_json) {
        Ok(s) => s,
        Err(_) => return String::from("{}"),
    };

    let mut total_budget = 0.0;
    let mut total_cost = 0.0;
    let mut total_variance = 0.0;

    for s in &stages {
        total_budget += s.budget;
        total_cost += s.cost;
        total_variance += s.variance;
    }

    let overall_status = if total_variance > 0.0 {
        "healthy"
    } else if total_variance > -100.0 {
        "warning"
    } else {
        "critical"
    };

    let agg = AggregateReconciliation {
        stage_count: stages.len(),
        total_budget: (total_budget * 10000.0).round() / 10000.0,
        total_cost: (total_cost * 10000.0).round() / 10000.0,
        total_variance: (total_variance * 10000.0).round() / 10000.0,
        overall_status: overall_status.to_string(),
    };

    match serde_json::to_string(&agg) {
        Ok(s) => s,
        Err(_) => String::from("{}"),
    }
}

/* --- Phase 63: Section-level diff for offline conflict detection --- */

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SectionItem {
    pub id: Option<String>,
    pub description: Option<String>,
    pub quantity: Option<f64>,
    pub rate: Option<f64>,
    pub actual: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SectionData {
    pub id: Option<String>,
    pub items: Option<Vec<SectionItem>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiffPayload {
    pub local: std::collections::HashMap<String, SectionData>,
    pub remote: std::collections::HashMap<String, SectionData>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiffConflict {
    pub section_id: String,
    pub section_name: String,
    pub conflict_type: String, /* "item_changed" | "item_added" | "item_removed" | "section_missing" */
    pub local_item_count: usize,
    pub remote_item_count: usize,
}

/* Returns a JSON array of DiffConflict objects for sections that diverged between local and remote. */
#[wasm_bindgen]
pub fn diff_sections(payload_json: &str) -> String {
    let payload: DiffPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(_) => return String::from("[]"),
    };

    let mut conflicts: Vec<DiffConflict> = Vec::new();

    /* Check every local section against its remote counterpart */
    for (sec_name, local_sec) in &payload.local {
        match payload.remote.get(sec_name) {
            None => {
                conflicts.push(DiffConflict {
                    section_id: local_sec.id.clone().unwrap_or_else(|| sec_name.clone()),
                    section_name: sec_name.clone(),
                    conflict_type: String::from("section_missing"),
                    local_item_count: local_sec.items.as_ref().map_or(0, |v| v.len()),
                    remote_item_count: 0,
                });
            }
            Some(remote_sec) => {
                let local_items = local_sec.items.as_ref().map_or(0, |v| v.len());
                let remote_items = remote_sec.items.as_ref().map_or(0, |v| v.len());

                /* Count how many items differ by id+rate+quantity */
                let mut changed = 0usize;
                if let (Some(li), Some(ri)) = (&local_sec.items, &remote_sec.items) {
                    use std::collections::HashMap;
                    let remote_map: HashMap<String, &SectionItem> = ri
                        .iter()
                        .filter_map(|it| it.id.as_ref().map(|id| (id.clone(), it)))
                        .collect();
                    for litem in li {
                        if let Some(id) = &litem.id {
                            match remote_map.get(id) {
                                None => { changed += 1; }
                                Some(ritem) => {
                                    let rate_diff = (litem.rate.unwrap_or(0.0) - ritem.rate.unwrap_or(0.0)).abs();
                                    let qty_diff  = (litem.quantity.unwrap_or(0.0) - ritem.quantity.unwrap_or(0.0)).abs();
                                    if rate_diff > 0.001 || qty_diff > 0.001 { changed += 1; }
                                }
                            }
                        }
                    }
                }

                if local_items != remote_items || changed > 0 {
                    let ctype = if local_items != remote_items {
                        if local_items > remote_items { String::from("item_added") } else { String::from("item_removed") }
                    } else {
                        String::from("item_changed")
                    };
                    conflicts.push(DiffConflict {
                        section_id: local_sec.id.clone().unwrap_or_else(|| sec_name.clone()),
                        section_name: sec_name.clone(),
                        conflict_type: ctype,
                        local_item_count: local_items,
                        remote_item_count: remote_items,
                    });
                }
            }
        }
    }

    /* Also flag sections that exist remotely but not locally */
    for (sec_name, remote_sec) in &payload.remote {
        if !payload.local.contains_key(sec_name) {
            conflicts.push(DiffConflict {
                section_id: remote_sec.id.clone().unwrap_or_else(|| sec_name.clone()),
                section_name: sec_name.clone(),
                conflict_type: String::from("section_missing"),
                local_item_count: 0,
                remote_item_count: remote_sec.items.as_ref().map_or(0, |v| v.len()),
            });
        }
    }

    match serde_json::to_string(&conflicts) {
        Ok(s) => s,
        Err(_) => String::from("[]"),
    }
}

#[wasm_bindgen(start)]
pub fn main() {
}
