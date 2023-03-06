import { createHmac } from "crypto";
import { Contract, providers } from "ethers";
import { Signer } from "ethers/lib/ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { createNoSubstitutionTemplateLiteral, isCatchClause } from "typescript";
import Web3Modal from "web3modal";
import {useAsyncEffect} from "use-async-effect";

import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import styles from '../styles/Home.module.css'

type Proposal = {
  proposalID: number, 
  nftTokenID: string,
  deadline: Date,
  yesVotes:string,
  noVotes: string,
  executed: boolean,
}

export default function Home(){
  //ETH Balance of the DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  //Number of proposals created in the DAO
  const [numProposals, setNumProposals] = useState(0);
  //Array of all porposals created in the DAO
  const [proposals, setProposals] = useState<Proposal[] | []>([]);
  //Users balance of CryptoDevs NFT's
  const [nftBalance, setNftBalance] = useState(0);
  //Fake NFT TokenID to purchase. Used when creating a proposal
  const [fakeNftTokenID, setFakeNftTokenID] = useState("");
  //One of "Create Proposal" or "View Proposals"
  const [selectedTab, setSelectedTab] = useState("");
  //True if waiting for a transaciton to be ined, false otherwise
  const [loading, setLoading] = useState(false);
  //Treu if user has connected their Wallet, false otherwise
  const [walletConnected, setWalletConnected] = useState(false);
  //isOwner gets the owner of the contract through the signed address
  const [isOwner, setIsOwner] = useState(false);
  const web3ModalRef = useRef<any>();

  //Helper funciton to connect wallet
  const connectWallet = async() => {
    try{
      await getProviderOrSigner();
      setWalletConnected(true);
    }catch(error){
      console.error(error);
    }
  };

  const getDAOOwner = async () => {
    try{
      const signer = await getProviderOrSigner(true);
      const contract = getDAOContractInstance(signer);

      //call the owner function from the contract
      const _owner = await contract.owner();
      //GEt the address associated to signer 
      const address = await signer!.getAddress();
      if(address.toLowerCase() === _owner.toLowerCase()){
        setIsOwner(true);
      }
    }catch(err: any){
      console.error(err.message);
    }
  };

  const withdrawDAOEther = async () => {
    try{
      const signer = await getProviderOrSigner(true);
      const contract = getDAOContractInstance(signer);

      const tx = await contract.withdrawEther();
      setLoading(true);
      await tx.wait();
      setLoading(false);
      getDAOTreasuryBalance();
    }catch(err: any)
    {
      console.error(err);
      window.alert(err.reason);
    }
  };

  const getDAOTreasuryBalance = async () => {
    try{
      const provider = await getProviderOrSigner();
      const balance = await provider!.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setTreasuryBalance(balance.toString());
    }catch(error: any)
    {
      console.error(error);
    }
  };

  const getNumProposalsInDAO = async () => {
    try{
      const provider = await getProviderOrSigner();
      const contract = getDAOContractInstance(provider);
      const daoNumProposals = await contract.numProposals();
      setNumProposals(daoNumProposals.toString());
    }catch(error: any)
    {
      console.error(error);
    }
  };

  const getUserNFTBalance = async () => {
    try{
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptoDevsNFTContractInstance(signer);
      const balance = await nftContract.balanceOf(signer!.getAddress());
      setNftBalance(parseInt(balance.toString()));
    }catch(error: any)
    {
      console.error(error);
    }
  };

  const createProposal = async () => {
    try{
      const signer = await getProviderOrSigner(true);
      const daoContract = getDAOContractInstance(signer);
      const txn = await daoContract.createProposal(fakeNftTokenID);
      setLoading(true);
      await txn.wait();
      await getNumProposalsInDAO();
      setLoading(false);
    }catch(error: any)
    {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  const fetchProposalByID = async (id: any) => {
    try{
      const provider = await getProviderOrSigner();
      const daoContract = getDAOContractInstance(provider);
      const proposal = await daoContract.proposals(id);
      const parsedProposal: Proposal = {
        proposalID: id, 
        nftTokenID: proposal.nftTokenID.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yesVotes: proposal.yesVotes.toString(),
        noVotes: proposal.noVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    }catch(error: any)
    {
      console.error(error);
    }
  };

  const fetchAllProposals= async () => {
    try{
      const proposals: Proposal[] = [];
      for (let i = 0; i < numProposals; i++)
      {
        const fetchedProposal = await fetchProposalByID(i);
        const proposal: Proposal = {
          proposalID: fetchedProposal!.proposalID, 
          nftTokenID: fetchedProposal!.nftTokenID,
          deadline: fetchedProposal!.deadline,
          yesVotes: fetchedProposal!.yesVotes,
          noVotes: fetchedProposal!.noVotes,
          executed: fetchedProposal!.executed,
        }
        proposals.push(proposal);
      }
      setProposals(proposals);
    }catch(error)
    {
      console.error(error);
    }
  };

  const voteOnProposal = async (proposalID: any, _vote: any) =>{
    try{
      const signer = await getProviderOrSigner(true);
      const daoContract = getDAOContractInstance(signer);

      let vote = _vote === "YES" ? 0 : 1;
      const txn = await daoContract.voteOnProposal(proposalID, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    }catch(error: any)
    {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  const executeProposal = async (proposalID: any) =>{
    try{
      const singer = getProviderOrSigner();
      const daoContract = getDAOContractInstance(singer);
      const txn = await daoContract.executeProposal(proposalID);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
      getDAOTreasuryBalance();
    }catch(error: any)
    {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  const getProviderOrSigner = async (needSigner = false) => {
    try{
      const provider = await web3ModalRef.current!.connect();
      const web3Provider = new providers.Web3Provider(provider);

      const { chainId } = await web3Provider.getNetwork();
      if(chainId !== 5)
      {
        window.alert("Please switch to the Goerli network!");
        throw new Error("Please switch to the Goerli network");
      }

      if(needSigner)
      {
        const signer: any = web3Provider.getSigner();
        return signer;
      }
      return web3Provider;
    }catch(error: any)
    {
      console.error(error);
      window.alert(error.data.message);
    }
  }

  const getDAOContractInstance = (providerOrSigner: any) => {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    );
  };

  const getCryptoDevsNFTContractInstance = (providerOrSigner: any) => {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    );
  };

  useEffect(() => {
    if(!walletConnected){
      web3ModalRef.current = new Web3Modal({
        network: "goerli",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      
      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
        getDAOOwner();
      });
    }
  }, [walletConnected]);

  useEffect(() => {
    if(selectedTab === "View Proposals")
    {
      fetchAllProposals();
    }
  }, [selectedTab]);

  //renders the 'Create Proposal' tab
  function renderTabs()
  {
    if(selectedTab === "Create Proposal")
    {
      return renderCreateProposalTab();
    }
    else if(selectedTab === "View Proposals")
    {
      return renderViewProposalsTab();
    }

    return null;
  }

  //Renders the 'Create Proposal' tab content
  function renderCreateProposalTab()
  {
    if(loading){
      return(
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    }
    else if (nftBalance === 0) 
    {
      return(
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You can not crete or vote on Proposals</b>
        </div>
      );
    }
    else
    {
      return(
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenID(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  function renderViewProposalsTab(){
    if(loading)
    {
      return(
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    }
    else if(proposals.length === 0)
    {
      return(
        <div className={styles.description}>No Proposals have been created</div>
      );
    }
    else
    {
      return(
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalID}</p>
              <p>Fake NFT to Purchase: {p.nftTokenID}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yes Votes: {p.yesVotes}</p>
              <p>No Votes: {p.noVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button className={styles.button2} onClick={() => voteOnProposal(p.proposalID, "YES")}>Vote YES</button>
                  <button className={styles.button2} onClick={() => voteOnProposal(p.proposalID, "NO")}>Vote NO</button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button className={styles.button2} onClick={() => executeProposal(p.proposalID)}>
                    Execute Proposal{" "}
                    {p.yesVotes > p.noVotes ? "(YES)" : "(No)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return(
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel= "icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button className={styles.button} onClick={() => setSelectedTab("Create Proposal")}>
              Create Proposal
            </button>
            <button className={styles.button} onClick={() => setSelectedTab("View Proposals")}>
              View Proposals
            </button>
          </div>
          {renderTabs()}
          {/*Display Additional withdraw button is connected wallet is owner */}
          {isOwner? (
            <div>
              {loading ? <button className={styles.button}>Loading...</button>
                       : <button className={styles.button} onClick={withdrawDAOEther}>Withdraw DAO ETH</button>
            }
            </div>
          ) : ("")}
        </div>
        <div>
          <img className={styles.image} src="cryptodevs/0.svg"/>
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by CryptoDevs
      </footer>
    </div>
  );
}