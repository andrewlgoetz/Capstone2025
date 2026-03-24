import { useEffect, useMemo, useState } from "react";
import { getItems, getCategories } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const CategoryDistribution = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { selectedLocationIds } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [itemData, categoryData] = await Promise.all([
          getItems(selectedLocationIds),
          getCategories(),
        ]);
        setItems(itemData);
        setCategories(categoryData.filter((c) => c.is_active));
      } catch (err) {
        console.error("Failed to fetch category distribution:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedLocationIds]);

  const topCategories = useMemo(() => {
    return categories
      .map((cat) => {
        const matched = items.filter((i) => i.category === cat.name);
        return {
          name: cat.name,
          quantity: matched.reduce((sum, i) => sum + (i.quantity || 0), 0),
          itemCount: matched.length,
        };
      })
      .filter((c) => c.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [categories, items]);

  const maxQuantity = topCategories[0]?.quantity || 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Category Distribution</h2>
        <p className="text-xs text-slate-500">Top categories by quantity</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[250px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : topCategories.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[250px]">
          <p className="text-slate-500 text-sm">No inventory data available.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-4">
          {topCategories.map((cat) => (
            <div key={cat.name} className="text-sm">
              <div className="flex justify-between items-end mb-1">
                <div>
                  <span className="font-semibold text-slate-800">{cat.name}</span>
                  <span className="text-xs text-slate-400 ml-1.5">
                    {cat.itemCount} {cat.itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {cat.quantity.toLocaleString()} units
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${(cat.quantity / maxQuantity) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryDistribution;
