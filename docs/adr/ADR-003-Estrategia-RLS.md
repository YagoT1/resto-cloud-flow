ADR-003 — Estrategia de Aislamiento Multitenant y Row Level Security

Estado: APPROVED
Fecha: 2026-06-23
Autor: Equipo RestoCloud
Depende de: ADR-001 Arquitectura Multitenant
Depende de: ADR-002 Autenticación y Roles

Contexto

RestoCloud es una plataforma SaaS multitenant para restaurantes.

Cada restaurante constituye una unidad independiente de negocio que debe mantener aislamiento total respecto de otros restaurantes.

La auditoría de seguridad identificó múltiples riesgos de exposición de datos relacionados con:

Policies RLS demasiado amplias.
Exposición pública de tablas.
Acceso cross-tenant.
Riesgos en Realtime.
Inserciones anónimas inseguras.
Enumeración de datos comerciales.
Problema

Se requiere definir una estrategia oficial para:

Aislamiento entre restaurantes.
Aislamiento entre sucursales.
Diseño de políticas RLS.
Acceso público al menú.
Pedidos QR.
Canales Realtime.
Principios de seguridad.
Definiciones
Tenant

Se define como tenant a:

Restaurant

Ejemplo:

Burger House

constituye un tenant independiente.

Subtenant

Se define como subtenant a:

Branch

Ejemplo:

Burger House

├─ Centro
├─ Norte
└─ Sur

Cada sucursal constituye una unidad operativa dentro del tenant.

Usuario

Persona autenticada mediante:

Supabase Auth
Rol

Definidos en ADR-002:

owner
general_manager
branch_manager
cashier
waiter
kitchen
customer
Principio de Aislamiento

Se adopta:

Zero Trust Architecture

Ningún cliente será considerado confiable.

Toda validación crítica deberá ejecutarse dentro de la base de datos.

Tenant Isolation
Decisión

Todo acceso a datos deberá estar restringido mediante:

restaurant_id
Regla

Ningún usuario perteneciente a un tenant podrá:

Leer datos de otro tenant.
Modificar datos de otro tenant.
Suscribirse a eventos de otro tenant.
Acceder a configuraciones de otro tenant.
Ejemplo

Permitido:

Burger House
→ Productos Burger House

Denegado:

Burger House
→ Productos Pizza World
Branch Isolation
Decisión

Se implementará aislamiento adicional por sucursal.

Toda entidad operativa deberá incorporar:

branch_id

cuando corresponda.

Roles Globales

Acceso a todas las sucursales:

Owner
General Manager
Roles Operativos

Acceso únicamente a sucursales asignadas:

Branch Manager
Cashier
Waiter
Kitchen
Branch Membership
Decisión

Se aprueba una relación muchos-a-muchos.

Un usuario puede pertenecer a múltiples sucursales.

Tabla Oficial
branch_members

Estructura conceptual:

id uuid
user_id uuid
branch_id uuid
created_at timestamptz

Constraint:

UNIQUE(user_id, branch_id)
Ejemplo
Valentina

→ Centro
→ Norte
Lucas

→ Norte
→ Sur
Estrategia RLS
Regla General

Toda policy deberá validar:

restaurant_id

como mínimo.

Segunda Capa

Cuando aplique:

branch_id

deberá ser validado adicionalmente.

Policies Prohibidas

Quedan prohibidas policies equivalentes a:

USING (true)

También quedan prohibidas:

USING (active = true)

como único mecanismo de control.

Justificación

Estas políticas permiten:

Enumeración de datos.
Fuga de información comercial.
Acceso cross-tenant.
Realtime
Problema

Los canales Realtime pueden producir fugas entre tenants.

Decisión

Todo canal deberá validar:

restaurant_id
+
branch_id
+
rol
Reglas

Owner:

Puede recibir eventos
de todo el tenant.

General Manager:

Puede recibir eventos
de todo el tenant.

Branch Manager:

Sólo sucursales asignadas.

Cashier:

Sólo sucursales asignadas.

Waiter:

Sólo sucursales asignadas.

Kitchen:

Sólo sucursales asignadas.
Objetivo

Eliminar cualquier posibilidad de:

Cross Tenant Realtime Leakage
Menú Público
Problema

Las tablas productivas no deben exponerse directamente.

Decisión

Se elimina el acceso anónimo directo a:

branches
categories
products
restaurant_tables
Arquitectura Oficial

Acceso mediante RPC controlada.

Ejemplo:

get_public_menu(slug)
Beneficios
Menor superficie de ataque.
Menor exposición de datos.
Mejor control de columnas visibles.
Mayor flexibilidad futura.
Pedidos QR
Problema

Las inserciones anónimas directas representan un riesgo.

Decisión

Se eliminan policies equivalentes a:

anon insert orders
anon insert order_items
Arquitectura Oficial

Se implementará:

create_public_order()

como función Security Definer.

Validaciones Obligatorias

La función deberá validar:

Restaurant válido.
Sucursal válida.
Mesa válida.
Productos válidos.
Precios vigentes.
Cantidades permitidas.
Objetivo

Impedir:

Manipulación de precios.
Manipulación de productos.
Spam.
Inserciones arbitrarias.
Gestión de Usuarios
Creación de Usuarios

Permitido:

Owner
General Manager
Creación de Usuarios Prohibida
Branch Manager
Cashier
Waiter
Kitchen
Customer
Justificación

Reduce:

Escalamiento de privilegios.
Errores administrativos.
Riesgos de auditoría.
Seguridad de Funciones

Toda función:

SECURITY DEFINER

deberá cumplir:

search_path explícito.
Validaciones internas.
Revisión de seguridad.
Documentación ADR asociada.
Plan de Implementación
Fase 1

Corrección de RLS críticas.

branches
categories
products
restaurant_tables
Fase 2

Implementar:

branch_members
Fase 3

Migrar menú público a RPC.

Fase 4

Migrar pedidos QR a RPC.

Fase 5

Endurecer Realtime.

Plan de Validación

Validar:

Tenant A
NO accede Tenant B

Validar:

Branch Manager Centro
NO accede Norte

Validar:

Kitchen
NO accede Caja

Validar:

Cashier
NO accede Mercado Pago

Validar:

Customer
NO accede Backoffice

Validar:

Realtime
NO fuga eventos
Consecuencias
Positivas
Aislamiento fuerte.
Compatible con SaaS comercial.
Compatible con franquicias.
Compatible con múltiples sucursales.
Compatible con auditorías futuras.
Reduce superficie de ataque.
Negativas
Mayor complejidad RLS.
Mayor complejidad de pruebas.
Más tablas de autorización.
Rollback

No se contempla eliminación del modelo multitenant.

Toda evolución futura deberá mantener:

Restaurant Isolation
+
Branch Isolation
+
Zero Trust

como principios obligatorios de la plataforma.