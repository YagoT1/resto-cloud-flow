ADR-002 — Autenticación y Roles

Estado: DRAFT v2
Fecha: 2026-06-23
Autor: Equipo RestoCloud
Depende de: ADR-001 Arquitectura Multitenant

Contexto

RestoCloud es una plataforma SaaS multitenant donde distintos tipos de usuarios operan diariamente:

Dueños
Gerentes Generales
Gerentes de Sucursal
Cajeros
Mozos
Cocina
Clientes

Actualmente existe el enum:

app_role

con los valores actuales:

owner
manager
cashier
waiter
kitchen
customer

Sin embargo, el crecimiento futuro de la plataforma requiere una diferenciación más precisa entre responsables operativos globales y responsables operativos de sucursales.

Se requiere definir un modelo formal de autenticación y autorización.

Problema

Se necesita determinar:

Qué es un usuario.
Qué es un rol.
Si una persona puede tener múltiples roles.
Cómo se gestionarán los permisos.
Cómo se mantendrá el aislamiento multitenant.
Cómo se gestionará la operación de múltiples sucursales.
Decisión
Modelo de Usuario

Un usuario representa una persona autenticada dentro de la plataforma.

Persona
↓
Usuario
↓
Roles

Ejemplo:

Yago Torres
↓
Usuario

Roles:
Owner
General Manager
Modelo RBAC

RestoCloud adopta:

RBAC
Role Based Access Control

Los permisos no se asignan directamente al usuario.

Los permisos se obtienen mediante roles.

Roles Oficiales

Los roles oficiales serán:

owner
general_manager
branch_manager
cashier
waiter
kitchen
customer
Jerarquía de Roles
Owner
│
├── General Manager
│
├── Branch Manager
│
├── Cashier
│
├── Waiter
│
└── Kitchen
Owner

Representa al propietario del restaurante.

Alcance
Todo el tenant.

Puede:

✓ Configurar restaurante
✓ Gestionar sucursales
✓ Gestionar usuarios
✓ Gestionar planes
✓ Ver reportes globales
✓ Configurar Mercado Pago
✓ Gestionar integraciones
✓ Acceso total

No posee restricciones internas.

General Manager

Representa al gerente general de la empresa.

Alcance
Todas las sucursales del tenant.

Puede:

✓ Gestionar personal
✓ Gestionar menú
✓ Gestionar pedidos
✓ Gestionar sucursales
✓ Ver reportes globales
✓ Gestionar caja
✓ Supervisar operación completa

No puede:

✗ Transferir propiedad
✗ Gestionar suscripción SaaS
✗ Modificar titularidad del restaurante
Branch Manager

Representa al gerente de una sucursal específica.

Alcance
Sólo sucursales asignadas.

Puede:

✓ Gestionar empleados de su sucursal
✓ Gestionar pedidos de su sucursal
✓ Gestionar mesas de su sucursal
✓ Gestionar caja de su sucursal
✓ Consultar reportes de su sucursal

No puede:

✗ Ver otras sucursales
✗ Ver reportes globales
✗ Gestionar suscripción SaaS
Cashier

Representa personal de caja.

Alcance
Sólo sucursales asignadas.

Puede:

✓ Cobrar pedidos
✓ Abrir caja
✓ Cerrar caja
✓ Emitir tickets
✓ Consultar arqueos

No puede:

✗ Gestionar usuarios
✗ Gestionar menú
✗ Configurar sistema
Waiter

Representa mozos.

Alcance
Sólo sucursales asignadas.

Puede:

✓ Crear pedidos
✓ Gestionar mesas
✓ Consultar estado de cocina

No puede:

✗ Acceder a caja
✗ Gestionar usuarios
✗ Ver reportes financieros
Kitchen

Representa personal de cocina.

Alcance
Sólo sucursales asignadas.

Puede:

✓ Ver pedidos
✓ Cambiar estados
✓ Marcar preparación
✓ Marcar listo

No puede:

✗ Acceder a caja
✗ Acceder a Mercado Pago
✗ Acceder a reportes financieros
Customer

Representa clientes finales.

Alcance
Pedidos propios.

Puede:

✓ Crear pedidos QR
✓ Consultar estado de pedido

No puede:

✗ Acceder al backoffice
✗ Consultar datos internos
Múltiples Roles

Un usuario puede poseer más de un rol.

Ejemplo:

Yago Torres

Owner
General Manager

Esto es válido.

Usuarios Multi-Restaurante

Se aprueba:

Un usuario puede pertenecer
a múltiples restaurantes.

Ejemplo:

Juan

Restaurant A
→ Branch Manager

Restaurant B
→ Owner
Tabla user_roles

La tabla:

user_roles

será la fuente oficial de autorización.

Principio de Menor Privilegio

Todo usuario recibirá únicamente:

Permisos necesarios
para realizar su trabajo.
Gestión de Invitaciones

Los usuarios serán invitados por:

Owner
General Manager

mediante correo electrónico.

Eliminación de Usuarios

No se eliminarán registros históricos.

Se aplicará:

Desactivación lógica

para preservar auditoría y trazabilidad.

Sesiones

La autenticación se delega a:

Supabase Auth

No se desarrollará un sistema propio de autenticación.

MFA

Se deja preparado para futura implementación:

MFA
2FA
Passkeys

No será obligatorio durante el MVP.

Auditoría

Toda acción sensible deberá registrar:

Usuario
Rol
Fecha
Acción
Entidad afectada

Los detalles serán definidos en ADR-007.

Consecuencias
Positivas
✓ Modelo escalable
✓ Compatible con Supabase
✓ Compatible con RLS
✓ Compatible con múltiples sucursales
✓ Compatible con cadenas gastronómicas
✓ Compatible con franquicias
Negativas
✗ Mayor complejidad de permisos
✗ Mayor complejidad de RLS
✗ Mayor necesidad de auditoría
Plan de Implementación
Validar tabla user_roles.
Diseñar modelo de asignación por sucursal.
Revisar funciones belongs_to_restaurant().
Revisar funciones has_role().
Implementar validación por rol.
Integrar con políticas RLS.
Plan de Validación

Validar:

Kitchen no ve caja.

Cashier no ve Mercado Pago.

Waiter no ve reportes.

Customer no ve backoffice.

Branch Manager no ve otras sucursales.

Usuarios de otros tenants
no acceden a recursos externos.
Rollback

En caso de modificación futura:

RBAC continuará siendo
el modelo oficial.

No se contempla migración a permisos individuales por usuario.

Decisiones Pendientes

Serán definidas en ADR-003:

Aislamiento por sucursal.

Diseño de branch_members.

Políticas RLS.

Realtime seguro.

Control de acceso por branch_id.