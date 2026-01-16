import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS,
         LineElement,
         CategoryScale,
         LinearScale,
         PointElement,
         Tooltip,
         Legend
} from "chart.js";

// csv: date,storeid,prodid,category,stock,sold,ordered
// use login authentication to show for one storeid
// default can just be s001
// let user switch between categories and narrow down to specific products
// each day is stock-sold+ordered?

ChartJS.register(
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend
);

export default function DemandLineChart() {
    const [chartData, setChartData] = useState(null);
    const [category, setCategory] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");

    useEffect(() => {
        Papa.parse("/demand_inventory.csv", {
            download:true,
            header:true,
            dynamicTyping:true,
            complete: (result) => {
                const rows = result.data;

                const uniqueCategories = Array.from(
                    new Set(rows.map((r) => r.category).filter(Boolean))
                  ).sort();
          
                  setCategory(uniqueCategories);
          
                  if (!selectedCategory && uniqueCategories.length) {
                    setSelectedCategory(uniqueCategories[0]);
                  }

                const filtered = rows.filter(r => 
                    r.store_id === "S003" && 
                    r.category===selectedCategory && 
                    r.date);
                const monthly_inventory = {};

                filtered.forEach((r) => {
                    const d = new Date(r.date);
                    if (isNaN(d)) return;
                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    
                    if (!monthly_inventory[ym]) {
                        monthly_inventory[ym] = {inventory_level: 0, units_sold: 0};
                    }

                    monthly_inventory[ym].inventory_level += Number(r.inventory_level) || 0;
                    monthly_inventory[ym].units_sold += Number(r.units_sold) || 0;
                });

                const sortedMonths = Object.keys(monthly_inventory)
                                           .filter((m) => m >= "2023-01")
                                           .sort();

                const labels = sortedMonths;

                const inventory = sortedMonths.map((m) => {
                                               return monthly_inventory[m].inventory_level - 
                                                      monthly_inventory[m].units_sold});

                //categories = rows;

                setChartData({
                    labels,
                    datasets: [ {
                        label: "Inventory Level",
                        data:inventory,
                        borderColor:"rgb(70, 0, 120)",
                        backgroundColor:"rgb(70,0,120,0.2)",
                        borderWidth:1.5,
                        tension:0.4,
                        pointRadius:1,
                    },],
                });
            },
        });
    }, [selectedCategory]);

    if (!chartData) return <div>Loading chart...</div>;

    return (
        <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}>
        <div style={{ display: "flex", gap: "12px" }}>
        <label style={{ color: "grey" }}>Category:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ padding: "6px" }}
        >
          {category.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        </div>
        <div className="w-full" style={{height: "400px"}}>
            <Line 
                data={chartData}
                options={{responsive:true,
                          maintainAspectRatio:false,
                          plugins:{
                                            title: {
                                            display: true,
                                            text: "Items Distributed per Month",
                                            font: { size: 18, weight: "bold" },
                                            padding: 20,
                                            align:"center"
                },
                                            legend:{display: true,
                                                    position:"top",
                                                    align:"center"
                                            },
                },
                scales: {
                    x: {title:{display: true, text:"Date (YYYY-MM)"}},
                    y: {title:{display:true,text:"Inventory Level"}},
                },
                }}/>
                </div>
            </div>);
}

//const DemandLineChart = {{inventory}} => 