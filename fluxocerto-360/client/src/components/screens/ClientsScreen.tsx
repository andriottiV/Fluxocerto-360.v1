import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { ScreenType } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPhone, sortBy } from "@/lib/utils";
import { ArrowLeft, Search, Plus, Trash2, Mail, Phone } from "lucide-react";

export default function ClientsScreen() {
  const { clients, goScreen } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortByField, setSortByField] = useState<"name" | "spent">("name");

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedClients =
    sortByField === "name"
      ? sortBy(filteredClients, "name", "asc")
      : sortBy(filteredClients, "totalSpent", "desc");

  const activeClients = clients.filter((c) => c.status === "ativo").length;
  const totalSpent = clients.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => goScreen(ScreenType.DASHBOARD)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
              <p className="text-sm text-gray-600">{activeClients} ativos</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <p className="text-sm text-blue-700 font-medium mb-1">Total de Clientes</p>
            <p className="text-3xl font-bold text-blue-900">{clients.length}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <p className="text-sm text-green-700 font-medium mb-1">Total Gasto</p>
            <p className="text-2xl font-bold text-green-900">{formatCurrency(totalSpent)}</p>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={sortByField === "name" ? "default" : "outline"}
              onClick={() => setSortByField("name")}
              className={sortByField === "name" ? "bg-blue-600 text-white" : ""}
            >
              Por Nome
            </Button>
            <Button
              variant={sortByField === "spent" ? "default" : "outline"}
              onClick={() => setSortByField("spent")}
              className={sortByField === "spent" ? "bg-blue-600 text-white" : ""}
            >
              Por Gasto
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {sortedClients.length === 0 ? (
            <Card className="p-8 text-center border-gray-200">
              <p className="text-gray-600 mb-2">Nenhum cliente encontrado</p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Cliente
              </Button>
            </Card>
          ) : (
            sortedClients.map((client) => (
              <Card key={client.id} className="p-4 border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {client.name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-gray-900">{client.name}</h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            client.status === "ativo"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {client.status === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <a href={`mailto:${client.email}`} className="hover:text-blue-600 truncate">
                            {client.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <a href={`tel:${client.phone}`} className="hover:text-blue-600">
                            {formatPhone(client.phone)}
                          </a>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-gray-600">
                        <p>Último serviço: {client.lastService}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="font-bold text-gray-900">{formatCurrency(client.totalSpent)}</p>
                    <button className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
