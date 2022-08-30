import { Entity, Column, PrimaryColumn, BaseEntity } from 'typeorm'

@Entity('guild')
export default class Guild extends BaseEntity {
  @PrimaryColumn('varchar')
  public id!: string

  @Column({ default: ',', type: 'varchar' })
  public prefix!: string
}
