ADR-001 — Arquitectura Multitenant

Estado: DRAFT
Fecha: 2026-06-23
Autor: Equipo RestoCloud
Decisión: Arquitectura SaaS Multitenant basada en aislamiento por restaurante.

Contexto

RestoCloud es una plataforma SaaS orientada a restaurantes, bares, cafeterías, rotiserías y cadenas gastronómicas.

La plataforma debe permitir que múltiples negocios operen sobre una misma infraestructura compartida sin que exista posibilidad de acceso cruzado entre clientes.

Los requisitos principales son:

Seguridad.
Escalabilidad.
Bajo costo operativo.
Facilidad de administración.
Compatibilidad con planes comerciales futuros.
Integración con pagos propios de cada restaurante.
Problema

Se necesita definir:

Qué constituye un tenant.
Cómo se aislarán los datos.
Cómo se modelarán sucursales.
Cómo se gestionarán usuarios.
Cómo se preparará la plataforma para crecimiento futuro.
Alternativas evaluadas
Alternativa A — Base de datos por restaurante
Restaurante A
→ Base A

Restaurante B
→ Base B

Restaurante C
→ Base C
Ventajas
Aislamiento máximo.
Menor riesgo de fuga entre clientes.
Desventajas
Costos elevados.
Administración compleja.
Difícil mantenimiento.
Difícil escalabilidad.
Resultado

RECHAZADA.

Alternativa B — Schema por restaurante
tenant_a.*
tenant_b.*
tenant_c.*
Ventajas
Aislamiento fuerte.
Menor riesgo de errores RLS.
Desventajas
Complejidad creciente.
Mantenimiento difícil.
Migraciones complejas.
Resultado

RECHAZADA.

Alternativa C — Base compartida con aislamiento lógico
restaurants
branches
products
orders

Todas las entidades contienen:

restaurant_id
Ventajas
Escalable.
Económica.
Compatible con Supabase.
Compatible con RLS.
Desventajas
Requiere disciplina estricta en seguridad.
Resultado

APROBADA.

Decisión
Modelo de Tenant

Un tenant corresponde a un restaurante.

Tenant
=
Restaurant

Ejemplo:

Pizzería Don Luigi
=
1 tenant
Modelo de Sucursales

Un restaurante puede poseer una o múltiples sucursales.

Restaurant
├── Branch 1
├── Branch 2
└── Branch N

Las sucursales no constituyen tenants independientes.

Clave de aislamiento

La clave de aislamiento actual será:

restaurant_id

Toda entidad de negocio deberá pertenecer a un restaurante.

Ejemplos:

products
categories
branches
orders
restaurant_tables
payments
cash_sessions
Evolución futura

Se reconoce la posibilidad futura de introducir:

tenant_id

para soportar:

Grupo gastronómico
├── Restaurante A
├── Restaurante B
└── Restaurante C

Sin embargo:

Versión actual
Tenant = Restaurant
Usuarios

Un usuario representa una persona autenticada.

Los permisos se asignan mediante roles.

Usuario
↓
Roles

Ejemplo:

Yago Torres
Owner
Manager
Roles iniciales
owner
manager
cashier
waiter
kitchen
customer

Los permisos serán definidos en ADR-002.

Acceso público

No se permitirá acceso público directo a tablas de negocio.

Queda prohibido:

anon SELECT products
anon SELECT categories
anon SELECT branches
anon SELECT restaurant_tables

sin filtrado explícito.

Estrategia pública

Los accesos públicos se implementarán mediante:

RPC
Views controladas
Security Definer Functions

según se defina en ADR-004.

Realtime

Realtime deberá respetar aislamiento multitenant.

Un usuario autenticado sólo podrá recibir eventos de su restaurante.

Queda prohibido:

Canales globales
Eventos cross-tenant
Suscripciones sin validación

Los detalles serán definidos en ADR-005.

Mercado Pago

RestoCloud operará bajo modelo SaaS.

RestoCloud

Cobrará:

Suscripciones

mediante su propia cuenta Mercado Pago.

Restaurantes

Cada restaurante conectará:

Su propia cuenta Mercado Pago

mediante OAuth.

Principio

Los fondos de los restaurantes nunca deberán pasar por cuentas de RestoCloud.

Escalabilidad objetivo

La arquitectura deberá soportar:

10.000+ restaurantes

sin rediseño estructural.

Principios obligatorios
Zero Trust

Nada se considera confiable por defecto.

Tenant First

Toda operación deberá conocer explícitamente:

restaurant_id
Secure by Default

La ausencia de una policy deberá implicar:

Denegado
Least Privilege

Cada usuario tendrá únicamente los permisos necesarios.

Consecuencias
Positivas
Arquitectura simple.
Compatible con Supabase.
Fácil mantenimiento.
Escalable.
Menor costo operativo.
Negativas
Dependencia fuerte de RLS.
Riesgo elevado si se crean policies incorrectas.
Requiere auditorías periódicas.
Plan de Implementación
Definir roles (ADR-002).
Definir estrategia RLS (ADR-003).
Definir acceso público QR (ADR-004).
Definir Realtime (ADR-005).
Definir Mercado Pago (ADR-006).
Plan de Validación

Validar que:

Ningún usuario acceda a otro restaurante.
Ningún evento realtime cruce tenants.
Ninguna consulta pública exponga datos privados.
Ninguna integración externa rompa el aislamiento.
Rollback

En caso de fallo:

Tenant = Restaurant

seguirá siendo el modelo oficial.

No se contempla rollback a modelos por schema o por base de datos.

Estado actual: DRAFT
Próxima revisión: ADR-002 Autenticación y Roles.