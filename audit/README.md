# Audit governamental — ReferendumJa

Aquest directori conté tot el necessari perquè el Govern d'Andorra (o qualsevol auditor independent) verifiqui la legitimitat de les signatures **sense que els organitzadors hi tinguin accés**.

## Per què aquest disseny

- El càlcul es fa **air-gapped** (sense xarxa) : el contenidor Docker s'executa amb `--network=none`.
- L'únic resultat publicat és **un nombre agregat** : quantes signatures corresponen a NIA reals. Cap correspondència individual no és produïda ni emmagatzemada.
- Els paràmetres criptogràfics són **idèntics** als del client (vegeu `audit.py` i comparar amb `packages/crypto/src/params.ts`). Qualsevol divergència és un bug bloquejant.

## Procediment recomanat

1. Descarregar el contenidor signat GPG des de la pàgina de versions del repositori principal.
2. Verificar la signatura GPG.
3. Carregar el contenidor a la màquina segura del Servei d'Immigració.
4. Exportar la llista oficial de NIA dels ciutadans andorrans en un CSV amb columna `nia`.
5. Descarregar el snapshot del dia objectiu des del repositori d'arxius.
6. Verificar la Merkle root del snapshot amb `verify_merkle.py`.
7. Llançar `audit.py` air-gapped amb `docker run --network=none ...`.
8. Publicar el resultat JSON (sense les llistes brutes).

## Nivell 2 (sel segellat)

Quan el sistema es desplega en Nivell 2, els cinc dipositaris reconstitueixen el `secret_salt` en una cerimònia pública filmada, i el remeten al Govern. El paràmetre `--secret-salt <base64>` activa aquest mode al script.

## Verificació indep. del client (sense la llista oficial)

Qualsevol persona pot verificar que **els seus propis vectors de prova** corresponen a la implementació criptogràfica. Per fer-ho, comparar la sortida del script Python amb els vectors a `packages/crypto/tests/fixtures/commitment_vectors.json`. Si tots coincideixen, la implementació és conforme. Això **no permet** desanonimitzar la petició — només verifica que el codi fa el que afirma fer.
