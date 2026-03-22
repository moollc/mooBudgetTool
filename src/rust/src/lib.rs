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

#[wasm_bindgen(start)]
pub fn main() {
}
