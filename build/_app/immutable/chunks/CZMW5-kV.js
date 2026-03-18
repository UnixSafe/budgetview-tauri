import{b as c,m as E,g as s,d as i}from"./Bihr2DuN.js";import{q as h,e as o}from"./DLSLEMkR.js";class m{#a=c(E([]));get accounts(){return s(this.#a)}set accounts(a){i(this.#a,a,!0)}#t=c(!1);get loading(){return s(this.#t)}set loading(a){i(this.#t,a,!0)}#e=c(null);get error(){return s(this.#e)}set error(a){i(this.#e,a,!0)}async load(){this.loading=!0,this.error=null;try{this.accounts=await h(`SELECT a.*,
					a.initial_balance + COALESCE(
						(SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.id),
						0
					) as computed_balance
				 FROM accounts a
				 WHERE a.is_active = 1
				 ORDER BY a.name`)}catch(a){this.error=a instanceof Error?a.message:"Erreur inconnue"}finally{this.loading=!1}}async create(a){await o("INSERT INTO accounts (name, account_number, bank_name, account_type, initial_balance) VALUES ($1, $2, $3, $4, $5)",[a.name,a.account_number??null,a.bank_name??null,a.account_type,a.initial_balance]),await this.load()}async update(a,t){const e=[],n=[];let r=1;for(const[l,u]of Object.entries(t))u!==void 0&&(e.push(`${l} = $${r++}`),n.push(u));e.length>0&&(n.push(a),await o(`UPDATE accounts SET ${e.join(", ")} WHERE id = $${r}`,n),await this.load())}async remove(a){await o("UPDATE accounts SET is_active = 0 WHERE id = $1",[a]),await this.load()}getBalance(a){return a.computed_balance}get totalBalance(){return this.accounts.reduce((a,t)=>a+t.computed_balance,0)}}const p=new m;export{p as a};
